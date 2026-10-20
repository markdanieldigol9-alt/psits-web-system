---
trigger: always_on
description: Data architecture and UI/UX standards for report generation, printing, Excel export, and PDF saving in table format.
---

# Report and Export Data Standards

When designing, updating, or implementing reports, document previews, print workflows, or data exports:

1. **Table-First Data Architecture**:
   - All report features must organize and source their data through a structured **Table Format** (tabular rows, defined columns, and explicit data fields).
   - Document previews and printable reports must render clean, readable tables with clear headers, borders, and structured cells rather than relying solely on unstructured cards or loose text.

2. **Excel / Spreadsheet Export (`Export Excel` / CSV)**:
   - Data extraction for Excel/CSV exports must be directly mapped from the structured tabular dataset.
   - Column headers in exported files must use clear, human-readable labels (e.g., `#`, `Member ID`, `Full Name`, `Email Address`, `Gross Amount (PHP)`, `Status`).
   - Numerical values (amounts, counts) must be formatted as clean numbers without stray currency symbols in raw data, and dates must be normalized (e.g., `YYYY-MM-DD` or localized string).
   - Exported records must accurately reflect all active table filters (search query, category, institution, status).

3. **Print Report (`Print Report`)**:
   - Printing must render the complete, unpaginated table dataset (temporarily expanding page size to `all` so no rows are omitted).
   - Use dedicated printable containers (e.g., `#printable-report-area`) with `@media print` styling ensuring high-contrast black/white backgrounds and visible grid borders.
   - All interactive controls, search inputs, filter bars, action buttons, and pagination controls must have the `no-print` class or be hidden via `@media print`.

4. **Save PDF (`Save PDF`)**:
   - The Save PDF function must trigger the print-to-PDF workflow targeting the structured table layout in `#printable-report-area`.
   - Ensure table rows have CSS `break-inside: avoid` to prevent awkward cutoffs across page breaks.
   - The output document must include standard institutional metadata (Report Title, Subtitle, Generated Date, Author / Officer Name, and Total Record Count).
