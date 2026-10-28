# Data and storage

Applications are stored in `localStorage` for the current browser and origin under `job-application-checklist.v1`. They are not encrypted or synced. Private browsing, clearing site data, changing the address or port, or switching browsers can remove or hide access to them. Other users of the same browser profile can access them.

JSON export downloads the current versioned data to the browser's configured download location. It is not encrypted and there is no import feature. Do not rely on browser storage as the only copy of important information.

## Status and dashboard

The first checked checklist step changes Not started to In progress. Checking Submit application marks an active application Submitted. Choosing Submitted, Awaiting response, Assessment, Interview, Offer or Offer accepted checks that step, records a submission timestamp and fills Date applied if blank. Correct Date applied in the editor when recording an earlier submission.

Moving back to Not started or In progress clears the submission timestamp, Date applied and submission checkbox. Rejected and Withdrawn preserve any existing submission history. Stage reached is independent of status and is not cleared automatically.

Coming up includes active applications due within seven local calendar days and overdue applications. Missing documents means an active application with an incomplete Tailor CV or Write cover letter step. Recently submitted shows the latest three applications by Date applied. Totals count all applications; search and filters affect the card and table views.

## Schema and recovery

The current envelope is `{ version: 2, applications: [...] }`. Records contain the ID, company, title, deadline, link, status, seven checklist booleans, creation and submission timestamps, and optional location, job type, work arrangement, salary, contact, stage and application date. Calendar dates use `YYYY-MM-DD`.

Version 1 records are validated and upgraded in memory with blank optional fields and a Date applied derived from an existing submission timestamp. Reading does not write storage; the next successful user save writes version 2. IDs, existing fields, checklist progress and timestamps are preserved. Close older app tabs during an upgrade: older versions cannot read the new envelope.

Unknown schemas, malformed records and duplicate IDs block writes without resetting stored data. Failed saves leave the previous state in place and show a retry message. A change from another tab refreshes the list and closes an open editor to reduce stale overwrites; simultaneous writes across tabs are not transactional.

Keep checklist ordering stable. Future schema changes must validate and migrate existing records before writing, preserve incompatible data for recovery, and avoid silent resets.
