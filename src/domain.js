export const STATUSES = ['Not started', 'In progress', 'Submitted', 'Interview', 'Offer', 'Rejected'];
export const TASKS = ['Read the job description', 'Tailor CV', 'Write cover letter', 'Complete application form', 'Submit application', 'Send follow-up', 'Prepare for interview'];
export const STORAGE_KEY = 'job-application-checklist.v1';
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.valueOf()) && localDate(date) === value;
}
export function dayDifference(deadline, today = localDate()) {
  return Math.round((Date.parse(`${deadline}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000);
}
export function active(application) { return ['Not started', 'In progress'].includes(application.status); }
export function missingDocuments(application) { return active(application) && (!application.tasks[1] || !application.tasks[2]); }
export function safeUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
export function validateApplication(app) {
  return app && typeof app.id === 'string' && app.id.length > 0 &&
    typeof app.company === 'string' && app.company.trim().length > 0 && app.company.length <= 100 &&
    typeof app.title === 'string' && app.title.trim().length > 0 && app.title.length <= 150 &&
    validDate(app.deadline) && typeof app.link === 'string' && !!safeUrl(app.link) &&
    STATUSES.includes(app.status) && Array.isArray(app.tasks) && app.tasks.length === TASKS.length && app.tasks.every(x => typeof x === 'boolean') &&
    typeof app.createdAt === 'string' && Number.isFinite(Date.parse(app.createdAt)) &&
    (app.submittedAt === null || (typeof app.submittedAt === 'string' && Number.isFinite(Date.parse(app.submittedAt))));
}
export function readApplications(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return [];
  const data = JSON.parse(raw);
  if (data.version !== 1 || !Array.isArray(data.applications) || !data.applications.every(validateApplication) || new Set(data.applications.map(x => x.id)).size !== data.applications.length) {
    throw new Error('Saved data could not be read. It has been preserved.');
  }
  return data.applications;
}
export function saveApplications(storage, applications) {
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, applications }));
}
export function updateStatus(app, status, now = new Date().toISOString()) {
  const tasks = [...app.tasks];
  if (['Submitted', 'Interview', 'Offer'].includes(status)) tasks[4] = true;
  if (['Not started', 'In progress'].includes(status)) tasks[4] = false;
  return { ...app, tasks, status, submittedAt: ['Not started', 'In progress'].includes(status) ? null : ['Submitted', 'Interview', 'Offer'].includes(status) ? app.submittedAt || now : app.submittedAt };
}
export function updateTask(app, index, checked, now) {
  let result = { ...app, tasks: app.tasks.map((x, i) => i === index ? checked : x) };
  if (index === 4 && checked && active(app)) result = updateStatus(result, 'Submitted', now);
  else if (index === 4 && !checked && app.status === 'Submitted') result = { ...result, status: 'In progress', submittedAt: null };
  else if (app.status === 'Not started' && checked) result.status = 'In progress';
  return result;
}
