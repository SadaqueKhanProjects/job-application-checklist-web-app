# UI design

- Put deadlines and unfinished documents before aggregate statistics; keep status totals in an expandable pipeline.
- Use slate for structure, teal for primary actions, amber for urgency and rose for overdue items. Text labels carry the same meaning without relying on colour.
- Keep checklist tasks visible. Reveal job and contact details on demand to reduce scanning effort.
- Suggest next steps from the current stage without changing saved tasks. Closed applications do not suggest more preparation.
- Quick filters start a fresh selection; the search and dropdowns then narrow it. Reset filters restores all applications while retaining sort order.
- Preserve keyboard focus after checklist updates. When a record leaves the current filter, announce the change and focus the application heading.
- Use native form controls and dialogs, visible focus rings, larger touch targets and reduced-motion-aware scrolling. Stack panels and controls on small screens.

## Verification

Validated with 22 local tests plus syntax and patch checks. Browser checks used fictional records on a separate localhost port: creation, text prefill, overdue/upcoming filters, document completion, focus recovery, table/checklist switching and persistence after reload. Desktop and 390px mobile screenshots are in `screenshots/`; the mobile page had no horizontal overflow. This is targeted interaction testing, not a full accessibility conformance audit.
