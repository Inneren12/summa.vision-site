#!/usr/bin/env python3
"""Run DuckDB-based smoke checks against processed datasets.

This script executes the SQL statement stored in ``duckdb/smoke_rowcount.sql``
for every CSV file located under ``data/processed``. The query is expected to
return a single integer column named ``rowcount``. The script aggregates the
results, prints a readable report to ``stdout`` and optionally writes a JSON
report to disk. If any dataset returns a non-positive rowcount the command
exits with a non-zero status code.
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable, List, Sequence

try:
    import duckdb  # type: ignore
except ImportError as exc:  # pragma: no cover - defensive guard
    raise SystemExit(
        "The `duckdb` Python package is required. Install it with `pip install duckdb`."
    ) from exc


DEFAULT_SQL_PATH = Path("duckdb/smoke_rowcount.sql")
DEFAULT_PROCESSED_DIR = Path("data/processed")


@dataclass
class SmokeResult:
    dataset_id: str
    relative_path: str
    absolute_path: str
    rowcount: int
    status: str


def discover_processed_csvs(processed_dir: Path) -> List[Path]:
    """Return all CSV files stored inside the processed data directory."""
    if not processed_dir.exists():
        raise FileNotFoundError(f"Processed data directory not found: {processed_dir}")

    return sorted(path for path in processed_dir.rglob("*.csv") if path.is_file())


def load_query(sql_path: Path) -> str:
    if not sql_path.exists():
        raise FileNotFoundError(f"DuckDB SQL template not found: {sql_path}")
    return sql_path.read_text(encoding="utf-8")


def run_rowcount_query(connection: "duckdb.DuckDBPyConnection", query: str, csv_path: Path) -> int:
    """Execute the rowcount query for a given CSV file and return the integer result."""
    result = connection.execute(query, [str(csv_path)]).fetchone()
    if result is None:
        raise RuntimeError(f"DuckDB query returned no result for {csv_path}")

    try:
        rowcount = int(result[0])
    except (TypeError, ValueError) as exc:
        raise RuntimeError(
            f"DuckDB query returned a non-integer result for {csv_path}: {result}"
        ) from exc

    return rowcount


def build_result(processed_dir: Path, csv_path: Path, rowcount: int) -> SmokeResult:
    relative_path = csv_path.relative_to(processed_dir)
    dataset_id = relative_path.parts[0] if relative_path.parts else csv_path.stem
    status = "pass" if rowcount > 0 else "fail"
    return SmokeResult(
        dataset_id=dataset_id,
        relative_path=str(relative_path),
        absolute_path=str(csv_path.resolve()),
        rowcount=rowcount,
        status=status,
    )


def generate_report_rows(results: Sequence[SmokeResult]) -> Iterable[str]:
    """Format a compact table summarising the smoke results."""
    headers = ("dataset", "rowcount", "status")
    dataset_width = max((len(r.relative_path) for r in results), default=len(headers[0]))
    dataset_width = max(dataset_width, len(headers[0]))
    rowcount_width = max((len(str(r.rowcount)) for r in results), default=len(headers[1]))
    rowcount_width = max(rowcount_width, len(headers[1]))

    yield f"{headers[0]:<{dataset_width}}  {headers[1]:>{rowcount_width}}  {headers[2]}"
    yield f"{'-' * dataset_width}  {'-' * rowcount_width}  {'-' * len(headers[2])}"

    for result in results:
        yield f"{result.relative_path:<{dataset_width}}  {result.rowcount:>{rowcount_width}}  {result.status}"


def write_json_report(output_path: Path, results: Sequence[SmokeResult]) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "summary": {
            "total_files": len(results),
            "failures": sum(1 for r in results if r.status != "pass"),
        },
        "results": [asdict(result) for result in results],
    }
    output_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run DuckDB smoke checks on processed datasets.")
    parser.add_argument(
        "--processed-dir",
        type=Path,
        default=DEFAULT_PROCESSED_DIR,
        help="Path to the directory containing processed datasets (default: data/processed).",
    )
    parser.add_argument(
        "--sql",
        type=Path,
        default=DEFAULT_SQL_PATH,
        help="Path to the DuckDB SQL file used for the smoke check (default: duckdb/smoke_rowcount.sql).",
    )
    parser.add_argument(
        "--json-report",
        type=Path,
        help="Optional path where a JSON report will be written.",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])

    csv_files = discover_processed_csvs(args.processed_dir)
    if not csv_files:
        raise SystemExit(f"No CSV files found in processed directory: {args.processed_dir}")

    query = load_query(args.sql)

    connection = duckdb.connect(database=":memory:")
    results: List[SmokeResult] = []

    for csv_path in csv_files:
        rowcount = run_rowcount_query(connection, query, csv_path)
        results.append(build_result(args.processed_dir, csv_path, rowcount))

    for row in generate_report_rows(results):
        print(row)

    if args.json_report is not None:
        write_json_report(args.json_report, results)

    failures = [result for result in results if result.status != "pass"]
    if failures:
        for failure in failures:
            print(
                f"ERROR: Dataset {failure.relative_path} has non-positive rowcount: {failure.rowcount}",
                file=sys.stderr,
            )
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
