-- smoke_rowcount.sql
-- Counts rows for a processed dataset referenced by the provided file path.
-- Parameters:
--   1. Absolute or relative path to a CSV file.
SELECT COUNT(*) AS rowcount
FROM read_csv_auto(?);
