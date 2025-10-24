#!/usr/bin/env bash

set -euo pipefail

CATALOG_PATH="data/catalog.yml"
RAW_ROOT="data/raw"
NOW_OVERRIDE=""

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

for line in "${DATASET_LINES[@]}"; do
  IFS=$'\t' read -r dataset_id sla_days <<<"$line"
  dataset_dir="$RAW_ROOT/$dataset_id"
  if [[ ! -d "$dataset_dir" ]]; then
    expired+=("$dataset_id (no data files found)")
    report_lines+=("$dataset_id: missing dataset directory at $dataset_dir")
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
    report_lines+=("$dataset_id: dataset directory contains no files")
    continue
  fi

  if (( NOW_SECONDS < newest_epoch )); then
    age_days=0
  else
    age_seconds=$(( NOW_SECONDS - newest_epoch ))
    age_days=$(( age_seconds / 86400 ))
  fi

  report_lines+=("$dataset_id: age=${age_days}d sla=${sla_days}d newest=$(basename "$newest_file")")

  if (( age_days > sla_days )); then
    expired+=("$dataset_id (age ${age_days}d > SLA ${sla_days}d)")
  fi
done

printf '%s\n' "Dataset freshness report:" "--------------------------"
for entry in "${report_lines[@]}"; do
  printf ' - %s\n' "$entry"
done

if (( ${#expired[@]} > 0 )); then
  printf '\nDatasets exceeding freshness SLA:\n'
  for entry in "${expired[@]}"; do
    printf ' - %s\n' "$entry"
  done
  exit 1
else
  printf '\nAll datasets are within the freshness SLA.\n'
fi

