#!/usr/bin/env bash

set -euo pipefail

CATALOG_PATH="data/catalog.yml"
RAW_ROOT="data/raw"
NOW_OVERRIDE=""
JSON_REPORT=""

usage() {
  cat <<'USAGE'
Usage: data_validate.sh [--catalog <path>] [--raw-dir <path>] [--now <epoch-seconds>]

Checks dataset freshness against the SLA defined in the catalog file. The
script searches for the most recent file inside each dataset directory under
the raw data root and compares its age in days with the declared SLA.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --catalog)
      [[ $# -ge 2 ]] || { echo "--catalog requires a path" >&2; exit 1; }
      CATALOG_PATH="$2"
      shift 2
      ;;
    --raw-dir)
      [[ $# -ge 2 ]] || { echo "--raw-dir requires a path" >&2; exit 1; }
      RAW_ROOT="$2"
      shift 2
      ;;
    --now)
      [[ $# -ge 2 ]] || { echo "--now requires an epoch timestamp" >&2; exit 1; }
      NOW_OVERRIDE="$2"
      shift 2
      ;;
    --json-report)
      [[ $# -ge 2 ]] || { echo "--json-report requires a path" >&2; exit 1; }
      JSON_REPORT="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "$CATALOG_PATH" ]]; then
  echo "Catalog file not found: $CATALOG_PATH" >&2
  exit 1
fi

if [[ ! -d "$RAW_ROOT" ]]; then
  echo "Raw data directory not found: $RAW_ROOT" >&2
  exit 1
fi

if [[ -n "$NOW_OVERRIDE" ]]; then
  if [[ "$NOW_OVERRIDE" =~ ^[0-9]+$ ]]; then
    NOW_SECONDS="$NOW_OVERRIDE"
  else
    echo "--now expects an integer epoch timestamp" >&2
    exit 1
  fi
else
  NOW_SECONDS="$(date +%s)"
fi

if stat --version >/dev/null 2>&1; then
  STAT_STYLE="gnu"
else
  STAT_STYLE="bsd"
fi

get_mtime() {
  local target="$1"
  if [[ "$STAT_STYLE" == "gnu" ]]; then
    stat -c '%Y' "$target"
  else
    stat -f '%m' "$target"
  fi
}

mapfile -t DATASET_LINES < <(
  CATALOG="$CATALOG_PATH" node <<'NODE'
const fs = require('fs');
const { parse } = require('yaml');

const catalogPath = process.env.CATALOG;
let doc;
try {
  doc = parse(fs.readFileSync(catalogPath, 'utf8'));
} catch (error) {
  console.error(`Failed to parse ${catalogPath}: ${error.message}`);
  process.exit(1);
}

if (!doc || !Array.isArray(doc.datasets)) {
  console.error(`Catalog ${catalogPath} must define a 'datasets' array.`);
  process.exit(1);
}

for (const dataset of doc.datasets) {
  if (!dataset || typeof dataset.id !== 'string' || dataset.id.length === 0) {
    console.error('Each dataset entry must include a non-empty "id".');
    process.exit(1);
  }

  if (typeof dataset.sla_days !== 'number' || Number.isNaN(dataset.sla_days)) {
    console.error(`Dataset ${dataset.id} must define a numeric sla_days value.`);
    process.exit(1);
  }

  console.log(`${dataset.id}\t${dataset.sla_days}`);
}
NODE
)

status=$?
if [[ $status -ne 0 ]]; then
  exit $status
fi

if [[ ${#DATASET_LINES[@]} -eq 0 ]]; then
  echo "No datasets defined in $CATALOG_PATH" >&2
  exit 1
fi

expired=()
report_lines=()
dataset_json_entries=()

for line in "${DATASET_LINES[@]}"; do
  IFS=$'\t' read -r dataset_id sla_days <<<"$line"
  dataset_dir="$RAW_ROOT/$dataset_id"
  if [[ ! -d "$dataset_dir" ]]; then
    expired+=("$dataset_id (no data files found)")
    message="$dataset_id: missing dataset directory at $dataset_dir"
    report_lines+=("$message")
    dataset_json_entries+=("$(printf '%s\t%s\t\tmissing\t\t%s' "$dataset_id" "$sla_days" "$message")")
    continue
  fi

  newest_file=""
  newest_epoch=0

  while IFS= read -r -d '' file_path; do
    if [[ -f "$file_path" ]]; then
      file_epoch=$(get_mtime "$file_path")
      if (( file_epoch > newest_epoch )); then
        newest_epoch=$file_epoch
        newest_file="$file_path"
      fi
    fi
  done < <(find "$dataset_dir" -type f -print0)

  if [[ -z "$newest_file" ]]; then
    expired+=("$dataset_id (no files in directory)")
    message="$dataset_id: dataset directory contains no files"
    report_lines+=("$message")
    dataset_json_entries+=("$(printf '%s\t%s\t\tempty\t\t%s' "$dataset_id" "$sla_days" "$message")")
    continue
  fi

  if (( NOW_SECONDS < newest_epoch )); then
    age_days=0
  else
    age_seconds=$(( NOW_SECONDS - newest_epoch ))
    age_days=$(( age_seconds / 86400 ))
  fi

  message="$dataset_id: age=${age_days}d sla=${sla_days}d newest=$(basename "$newest_file")"
  report_lines+=("$message")

  status="ok"
  if (( age_days > sla_days )); then
    expired+=("$dataset_id (age ${age_days}d > SLA ${sla_days}d)")
    status="expired"
  fi

  dataset_json_entries+=("$(printf '%s\t%s\t%d\t%s\t%s\t%s' "$dataset_id" "$sla_days" "$age_days" "$status" "$newest_file" "$message")")
done

printf '%s\n' "Dataset freshness report:" "--------------------------"
for entry in "${report_lines[@]}"; do
  printf ' - %s\n' "$entry"
done

exit_code=0

if (( ${#expired[@]} > 0 )); then
  printf '\nDatasets exceeding freshness SLA:\n'
  for entry in "${expired[@]}"; do
    printf ' - %s\n' "$entry"
  done
  exit_code=1
else
  printf '\nAll datasets are within the freshness SLA.\n'
fi

if [[ -n "$JSON_REPORT" ]]; then
  report_dir="$(dirname "$JSON_REPORT")"
  mkdir -p "$report_dir"

  DATASET_JSON_STREAM="$(printf '%s\n' "${dataset_json_entries[@]}")"

  CATALOG_PATH="$CATALOG_PATH" \
    RAW_ROOT="$RAW_ROOT" \
    NOW_SECONDS="$NOW_SECONDS" \
    JSON_REPORT_PATH="$JSON_REPORT" \
    DATASET_JSON_STREAM="$DATASET_JSON_STREAM" \
    node <<'NODE'
const fs = require('fs');
const path = require('path');

const catalogPath = process.env.CATALOG_PATH;
const rawRoot = process.env.RAW_ROOT;
const nowSeconds = Number(process.env.NOW_SECONDS || Date.now() / 1000);
const reportPath = process.env.JSON_REPORT_PATH;
const datasetStream = process.env.DATASET_JSON_STREAM || '';

const lines = datasetStream.length === 0 ? [] : datasetStream.split('\n').filter((line) => line.length > 0);

const datasets = lines.map((line) => {
  if (!line) {
    return null;
  }

  const [id, slaDays, ageDays, status, newestFile, message] = line.split('\t');
  const parsedSla = Number.isNaN(Number(slaDays)) ? null : Number(slaDays);
  const parsedAge = ageDays === undefined || ageDays === '' ? null : Number(ageDays);
  const newest = newestFile ? path.relative(process.cwd(), newestFile) : null;

  return {
    id: id || null,
    sla_days: parsedSla,
    age_days: parsedAge,
    status: status || null,
    newest_file: newest,
    message: message || null,
  };
}).filter(Boolean);

const byStatus = datasets.reduce((acc, dataset) => {
  const key = dataset.status || 'unknown';
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});

const failingStatuses = new Set(['expired', 'missing', 'empty']);
const failures = datasets.filter((dataset) => failingStatuses.has(dataset.status));

const report = {
  generated_at: new Date(nowSeconds * 1000).toISOString(),
  success: failures.length === 0,
  catalog_path: catalogPath,
  raw_data_root: rawRoot,
  summary: {
    total: datasets.length,
    passed: datasets.length - failures.length,
    failed: failures.length,
    by_status: byStatus,
  },
  datasets,
};

fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
NODE

  echo "Wrote JSON report to $JSON_REPORT"
fi

exit "$exit_code"
