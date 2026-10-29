# Excel export

The export uses the reference tracker's application columns, with added work arrangement, deadline, job link, progress and next step. It does not copy reference records or unrelated worksheets.

`src/excel-export.js` creates two SpreadsheetML worksheets in a ZIP package using browser APIs. There is no server, network request, dependency download or storage migration. Export always reads all applications and sorts them by deadline without modifying the source array. The existing JSON backup remains available.

Dates use Excel numeric values and a readable date format; missing dates remain blank. Salary remains text because users can enter ranges, currencies and hourly rates. Application text is serialized as inline strings, so formula-like input is not executed. Only HTTP(S) job links become external hyperlinks. Dropdowns cover status, job type, work arrangement and checklist values. Conditional formatting highlights overdue active applications and relevant outcomes. Progress and next-step values are explicitly labelled snapshots at export, not live calculations or a two-way sync.

The small ZIP writer supports only the fixed, uncompressed package needed here. The export is bounded to 100,000 records; practical limits depend on browser memory. Long contact details wrap and may need row-height adjustment in Excel.

## Validation

- 26 local tests passed, including ZIP CRC verification, complete record export, checklist values, XML escaping, literal formula-like text, unsafe links, empty exports, date boundaries and serving the export module.
- An independent openpyxl reader loaded a generated two-record workbook and verified sheet names, tables, dates, hyperlinks, percentages, checklist values, frozen headers and dropdown counts. Python ZIP and XML readers validated every package part.
- The export control was present in the browser. Download automation was interrupted and native Excel UI automation subsequently timed out, so end-to-end download and native visual verification remain unconfirmed.

Format reference: [Microsoft SpreadsheetML cell documentation](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.spreadsheet.cell).
