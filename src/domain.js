export const STATUSES = ['Not started', 'In progress', 'Submitted', 'Awaiting response', 'Assessment', 'Interview', 'Offer', 'Offer accepted', 'Rejected', 'Withdrawn'];
export const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Freelance'];
export const WORK_MODES = ['Onsite', 'Hybrid', 'Remote'];
export const TASKS = ['Read the job description', 'Tailor CV', 'Write cover letter', 'Complete application form', 'Submit application', 'Send follow-up', 'Prepare for interview'];
// Keep the original key so existing installs can discover their saved applications.
export const STORAGE_KEY = 'job-application-checklist.v1';
export const SCHEMA_VERSION = 2;
export const DETAIL_DEFAULTS = { location: '', jobType: '', workMode: '', salary: '', contact: '', stageReached: '', appliedOn: '' };
const SUBMITTED_STATUSES = ['Submitted', 'Awaiting response', 'Assessment', 'Interview', 'Offer', 'Offer accepted'];
const ORIGINAL_STATUSES = ['Not started', 'In progress', 'Submitted', 'Interview', 'Offer', 'Rejected'];

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
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
function validBase(app, statuses) {
  return app && typeof app.id === 'string' && app.id.length > 0 &&
    typeof app.company === 'string' && app.company.trim().length > 0 && app.company.length <= 100 &&
    typeof app.title === 'string' && app.title.trim().length > 0 && app.title.length <= 150 &&
    validDate(app.deadline) && typeof app.link === 'string' && !!safeUrl(app.link) &&
    statuses.includes(app.status) && Array.isArray(app.tasks) && app.tasks.length === TASKS.length && app.tasks.every(x => typeof x === 'boolean') &&
    typeof app.createdAt === 'string' && Number.isFinite(Date.parse(app.createdAt)) &&
    (app.submittedAt === null || (typeof app.submittedAt === 'string' && Number.isFinite(Date.parse(app.submittedAt))));
}
export function validateApplication(app) {
  const text = (key, max) => typeof app[key] === 'string' && app[key].length <= max;
  return validBase(app, STATUSES) && text('location', 150) && text('salary', 150) && text('contact', 1000) && text('stageReached', 100) &&
    ['', ...JOB_TYPES].includes(app.jobType) && ['', ...WORK_MODES].includes(app.workMode) &&
    (app.appliedOn === '' || validDate(app.appliedOn));
}
export function readApplications(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return [];
  const data = JSON.parse(raw);
  if (!data || ![1, SCHEMA_VERSION].includes(data.version) || !Array.isArray(data.applications)) throw new Error('Saved data could not be read. It has been preserved.');
  const valid = data.version === 1 ? app => validBase(app, ORIGINAL_STATUSES) : validateApplication;
  if (!data.applications.every(valid) || new Set(data.applications.map(x => x.id)).size !== data.applications.length) throw new Error('Saved data could not be read. It has been preserved.');
  // Migrate in memory only. Original storage is untouched until a successful user save.
  return data.version === 1 ? data.applications.map(app => ({ ...app, ...DETAIL_DEFAULTS, appliedOn: app.submittedAt ? localDate(new Date(app.submittedAt)) : '' })) : data.applications;
}
export function saveApplications(storage, applications) {
  if (!Array.isArray(applications) || !applications.every(validateApplication) || new Set(applications.map(app => app.id)).size !== applications.length) throw new Error('Application data is invalid.');
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, applications }));
}
export function updateStatus(app, status, now = new Date().toISOString()) {
  if (!STATUSES.includes(status)) throw new Error('Unknown application status.');
  const result = { ...DETAIL_DEFAULTS, ...app, tasks: [...app.tasks], status };
  if (SUBMITTED_STATUSES.includes(status)) {
    result.tasks[4] = true;
    result.submittedAt ||= now;
    result.appliedOn ||= localDate(new Date(result.submittedAt));
  } else if (active(result)) {
    result.tasks[4] = false;
    result.submittedAt = null;
    result.appliedOn = '';
  }
  if (['Rejected', 'Withdrawn'].includes(status) && result.appliedOn && !result.submittedAt) result.submittedAt = `${result.appliedOn}T12:00:00.000Z`;
  return result;
}
export function updateTask(app, index, checked, now) {
  let result = { ...app, tasks: app.tasks.map((x, i) => i === index ? checked : x) };
  if (index === 4 && checked && active(app)) result = updateStatus(result, 'Submitted', now);
  else if (index === 4 && !checked && app.status === 'Submitted') result = updateStatus(result, 'In progress', now);
  else if (app.status === 'Not started' && checked) result.status = 'In progress';
  return result;
}
export function filterApplications(applications, { query = '', status = 'all', jobType = 'all', workMode = 'all', sort = 'deadline' } = {}) {
  const search = query.trim().toLowerCase();
  return applications.filter(app => [app.company, app.title, app.location, app.stageReached, app.contact].join(' ').toLowerCase().includes(search) &&
    (status === 'all' || app.status === status) && (jobType === 'all' || app.jobType === jobType) && (workMode === 'all' || app.workMode === workMode))
    .sort((a, b) => sort === 'company' ? a.company.localeCompare(b.company) : sort === 'newest' ? b.createdAt.localeCompare(a.createdAt) : sort === 'applied' ? (b.appliedOn || '').localeCompare(a.appliedOn || '') : a.deadline.localeCompare(b.deadline));
}
