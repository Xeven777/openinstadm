-- ProcessedComment was never read or written. Comment deduplication uses DmLog
-- and live reply data, so remove the unused table.
DROP TABLE "ProcessedComment";
