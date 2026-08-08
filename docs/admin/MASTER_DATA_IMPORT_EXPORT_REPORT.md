# Master Data Import / Export Report

- **Bulk CSV / XLSX Export:** Built into `EnterpriseManager` toolbar. Generates filtered master records respecting current search, pagination, and group filters.
- **Bulk Import Wizard:** Accepts CSV files, parses master rows, performs case-normalization, trims whitespace, and executes idempotent `UPSERT` operations to prevent duplicate primary keys or codes.
