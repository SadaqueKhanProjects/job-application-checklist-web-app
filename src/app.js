import {
  STATUSES, JOB_TYPES, WORK_MODES, TASKS, STORAGE_KEY, SCHEMA_VERSION, DETAIL_DEFAULTS,
  active, missingDocuments, safeUrl, localDate, dayDifference, validDate,
  readApplications, saveApplications, updateStatus, updateTask, filterApplications,
} from './domain.js';

const $ = selector => document.querySelector(selector);
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const statusClass = status => status.toLowerCase().replaceAll(' ', '-');
const dateLabel = value => new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
let applications = [], editingId = null, deletingId = null, storageAvailable = true, view = 'cards';

function notify(message, error = false) {
  const notice = $('#notice');
  notice.hidden = false;
  notice.textContent = message;
  notice.className = error ? 'notice error' : 'notice';
  if (error) {
    const dialogError = $('#application-dialog').open ? $('#form-error') : $('#delete-dialog').open ? $('#delete-error') : null;
    if (dialogError) { dialogError.textContent = message; dialogError.hidden = false; }
  }
}
try {
  applications = readApplications(localStorage);
} catch {
  storageAvailable = false;
  notify('Saved data is unavailable or unreadable. Existing data has been preserved. Enable browser storage or recover it before making changes, then reload to retry.', true);
}
function commit(next) {
  if (!storageAvailable) {
    notify('Changes are paused to protect your saved data. Reload after restoring access to browser storage.', true);
    return false;
  }
  try {
    saveApplications(localStorage, next);
    applications = next;
    render();
    return true;
  } catch {
    notify('Could not save. Your change was not applied. Check your entries and browser storage, then try again.', true);
    return false;
  }
}
function deadlineMarkup(app) {
  const days = dayDifference(app.deadline);
  const warning = active(app) && days < 0;
  const urgent = active(app) && days >= 0 && days <= 3;
  const relative = warning ? `${Math.abs(days)} day${days === -1 ? '' : 's'} overdue` : days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `Due ${dateLabel(app.deadline)}`;
  return `<span class="deadline ${warning ? 'overdue' : urgent ? 'urgent' : ''}" title="${escape(dateLabel(app.deadline))}"><span aria-hidden="true">◷</span> ${escape(active(app) ? relative : `Deadline ${dateLabel(app.deadline)}`)}</span>`;
}
function priorityRow(app, detail) {
  return `<button class="priority-row" data-action="jump" data-id="${escape(app.id)}"><span class="mini-avatar">${escape(app.company.slice(0, 1).toUpperCase())}</span><span class="priority-text"><strong>${escape(app.company)}</strong><span>${escape(app.title)}</span></span><span class="priority-detail">${detail}</span></button>`;
}
function renderDashboard() {
  $('#stats').innerHTML = STATUSES.map(status => `<button class="stat ${statusClass(status)}" data-action="filter" data-status="${escape(status)}" aria-pressed="${$('#status-filter').value === status}"><span><i></i>${status}</span><strong>${applications.filter(app => app.status === status).length}</strong></button>`).join('');
  const due = applications.filter(app => active(app) && dayDifference(app.deadline) <= 7).sort((a, b) => a.deadline.localeCompare(b.deadline));
  $('#due-soon').innerHTML = due.slice(0, 3).map(app => priorityRow(app, deadlineMarkup(app))).join('') || '<p class="panel-empty">A little breathing room.<br>No deadlines in the next 7 days.</p>';
  if (due.length > 3) $('#due-soon').innerHTML += `<p class="panel-more">+${due.length - 3} more in your applications below</p>`;
  const missing = applications.filter(missingDocuments).sort((a, b) => a.deadline.localeCompare(b.deadline));
  $('#documents-count').textContent = missing.length;
  $('#documents').innerHTML = missing.slice(0, 3).map(app => priorityRow(app, `<span class="document-label">${[!app.tasks[1] && 'CV', !app.tasks[2] && 'Cover letter'].filter(Boolean).join('<br>')}</span>`)).join('') || '<p class="panel-empty">Everything is in good shape.<br>No outstanding CVs or cover letters.</p>';
  if (missing.length > 3) $('#documents').innerHTML += `<p class="panel-more">+${missing.length - 3} more in your applications below</p>`;
  const recent = applications.filter(app => app.appliedOn).sort((a, b) => b.appliedOn.localeCompare(a.appliedOn) || (b.submittedAt || '').localeCompare(a.submittedAt || '')).slice(0, 3);
  $('#recent').innerHTML = recent.map(app => priorityRow(app, `<span class="submitted-label">${escape(dateLabel(app.appliedOn))}</span>`)).join('') || '<p class="panel-empty">Your next opportunity is waiting.<br>Submitted applications will appear here.</p>';
  $('#total').textContent = applications.length;
}
function statusControl(app) {
  return `<span class="status-select ${statusClass(app.status)}"><select aria-label="Status for ${escape(app.title)} at ${escape(app.company)}" data-action="status" data-id="${escape(app.id)}">${STATUSES.map(status => `<option${status === app.status ? ' selected' : ''}>${status}</option>`).join('')}</select></span>`;
}
function detailList(app) {
  const pairs = [
    ['Location', app.location], ['Job type', [app.jobType, app.workMode].filter(Boolean).join(' · ')],
    ['Salary / rate', app.salary], ['Date applied', app.appliedOn && dateLabel(app.appliedOn)], ['Stage reached', app.stageReached],
  ].filter(([, value]) => value);
  if (!pairs.length && !app.contact) return '';
  return `<div class="application-details"><dl>${pairs.map(([key, value]) => `<div><dt>${key}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>${app.contact ? `<details class="contact-details"><summary>Contact details</summary><p>${escape(app.contact)}</p></details>` : ''}</div>`;
}
function actionButtons(app) {
  return `<button data-action="edit" data-id="${escape(app.id)}" class="text-button">Edit<span class="sr-only"> ${escape(app.company)}</span></button><button data-action="delete" data-id="${escape(app.id)}" class="icon-button delete-button" aria-label="Delete ${escape(app.title)} at ${escape(app.company)}">×</button>`;
}
function renderCard(app) {
  const complete = app.tasks.filter(Boolean).length;
  return `<article id="application-${escape(app.id)}" class="application-card ${active(app) && dayDifference(app.deadline) < 0 ? 'is-overdue' : ''}" tabindex="-1">
    <div class="card-top"><div class="company-avatar">${escape(app.company.slice(0, 2).toUpperCase())}</div><div class="card-title"><h3>${escape(app.title)}</h3><p>${escape(app.company)}</p></div>${statusControl(app)}</div>
    <div class="card-meta">${deadlineMarkup(app)}<a href="${escape(safeUrl(app.link))}" target="_blank" rel="noopener noreferrer">View job <span aria-hidden="true">↗</span></a></div>
    ${detailList(app)}
    <div class="progress-heading"><span>Application checklist</span><span>${complete} of ${TASKS.length}</span></div><progress max="${TASKS.length}" value="${complete}" aria-label="${escape(app.company)} checklist progress"></progress>
    <fieldset class="checklist"><legend class="sr-only">Checklist for ${escape(app.title)} at ${escape(app.company)}</legend>${TASKS.map((task, i) => `<label class="task ${app.tasks[i] ? 'complete' : ''}"><input type="checkbox" data-action="task" data-id="${escape(app.id)}" data-index="${i}"${app.tasks[i] ? ' checked' : ''}><span>${task}</span></label>`).join('')}</fieldset>
    <div class="card-bottom"><span>${complete === TASKS.length ? 'Every step complete. Well done!' : complete === 0 ? 'A fresh start. You’ve got this.' : 'One step at a time. Keep going.'}</span>${actionButtons(app)}</div>
  </article>`;
}
function renderTable(filtered) {
  const value = text => text ? escape(text) : '<span class="not-recorded">—<span class="sr-only">Not recorded</span></span>';
  return `<p class="table-hint">Scroll across for salary, deadlines, contacts and actions.</p><div class="table-scroll" role="region" aria-label="Application tracker table; scroll horizontally for more columns" tabindex="0"><table class="tracker-table"><caption class="sr-only">Job applications matching the current filters</caption><thead><tr>${['Company / role', 'Status', 'Stage reached', 'Date applied', 'Location', 'Job type / working', 'Salary / rate', 'Deadline', 'Contact', 'Actions'].map(label => `<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${filtered.map(app => `<tr class="${active(app) && dayDifference(app.deadline) < 0 ? 'overdue-row' : ''}">
    <th scope="row"><strong>${escape(app.company)}</strong><a href="${escape(safeUrl(app.link))}" target="_blank" rel="noopener noreferrer">${escape(app.title)} ↗</a></th>
    <td>${statusControl(app)}</td><td>${value(app.stageReached)}</td><td class="nowrap">${value(app.appliedOn && dateLabel(app.appliedOn))}</td><td>${value(app.location)}</td><td>${value([app.jobType, app.workMode].filter(Boolean).join(' · '))}</td><td>${value(app.salary)}</td><td>${deadlineMarkup(app)}</td>
    <td>${app.contact ? `<details class="contact-details"><summary>View contact</summary><p>${escape(app.contact)}</p></details>` : value('')}</td>
    <td><div class="table-actions"><button class="text-button" data-action="checklist" data-id="${escape(app.id)}">Checklist<span class="sr-only"> ${escape(app.company)}</span></button>${actionButtons(app)}</div></td>
  </tr>`).join('')}</tbody></table></div>`;
}
function renderSuggestions() {
  for (const [field, target] of [['company', 'company-suggestions'], ['location', 'location-suggestions']]) {
    const values = [...new Set(applications.map(app => app[field]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    $(`#${target}`).innerHTML = values.map(value => `<option value="${escape(value)}"></option>`).join('');
  }
}
function render() {
  renderDashboard();
  renderSuggestions();
  const filtered = filterApplications(applications, {
    query: $('#search').value, status: $('#status-filter').value,
    jobType: $('#job-type-filter').value, workMode: $('#work-mode-filter').value, sort: $('#sort').value,
  });
  $('#cards-view').setAttribute('aria-pressed', String(view === 'cards'));
  $('#table-view').setAttribute('aria-pressed', String(view === 'table'));
  $('#visible-count').textContent = `${filtered.length} of ${applications.length} application${applications.length === 1 ? '' : 's'} shown`;
  $('#applications').className = view === 'table' ? 'applications table-view' : 'applications';
  $('#applications').innerHTML = filtered.length ? (view === 'table' ? renderTable(filtered) : filtered.map(renderCard).join('')) :
    `<div class="empty-state"><div class="empty-icon" aria-hidden="true">✓</div><h3>${applications.length ? 'No matching applications' : 'Your next chapter starts here'}</h3><p>${applications.length ? 'Try a different search or filter.' : 'Add your first opportunity. We’ll help you take it one step at a time.'}</p><button class="${applications.length ? 'secondary' : 'primary'}" data-action="${applications.length ? 'clear' : 'add'}">${applications.length ? 'Clear filters' : '＋ Add your first application'}</button></div>`;
}
function fillOptions(selector, values) {
  for (const value of values) $(selector).add(new Option(value, value));
}
fillOptions('#status-filter', STATUSES);
fillOptions('#application-form select[name="status"]', STATUSES);
fillOptions('#job-type-filter', JOB_TYPES);
fillOptions('#work-mode-filter', WORK_MODES);
fillOptions('#application-form select[name="jobType"]', JOB_TYPES);
fillOptions('#application-form select[name="workMode"]', WORK_MODES);

function openForm(app = null) {
  editingId = app?.id || null;
  const form = $('#application-form');
  form.reset();
  form.elements.appliedOn.max = localDate();
  $('#dialog-title').textContent = app ? 'Edit application' : 'Add an application';
  if (app) for (const field of ['company', 'title', 'deadline', 'link', 'status', ...Object.keys(DETAIL_DEFAULTS)]) form.elements[field].value = app[field];
  $('#form-error').hidden = true;
  $('#application-dialog').showModal();
  form.elements.company.focus();
}
$('#add-application').addEventListener('click', () => openForm());
for (const id of ['close-dialog', 'cancel-dialog']) $(`#${id}`).addEventListener('click', () => $('#application-dialog').close());
$('#cancel-delete').addEventListener('click', () => $('#delete-dialog').close());
$('#application-form').addEventListener('submit', event => {
  event.preventDefault();
  const fields = Object.fromEntries(new FormData(event.target));
  for (const key of Object.keys(fields)) fields[key] = fields[key].trim();
  let error = '';
  if (!fields.company || !fields.title || !validDate(fields.deadline) || !safeUrl(fields.link)) error = 'Enter a company, job title, valid deadline and an http:// or https:// job link.';
  else if (fields.appliedOn && (!validDate(fields.appliedOn) || fields.appliedOn > localDate())) error = 'Date applied must be a valid date on or before today.';
  else if (fields.appliedOn && active(fields)) error = 'Choose Submitted or a later outcome when entering a date applied.';
  if (error) { $('#form-error').textContent = error; $('#form-error').hidden = false; return; }
  const existing = applications.find(app => app.id === editingId);
  const app = updateStatus({ ...(existing || { ...DETAIL_DEFAULTS, id: crypto.randomUUID(), tasks: TASKS.map(() => false), createdAt: new Date().toISOString(), submittedAt: null }), ...fields }, fields.status);
  if (commit(existing ? applications.map(item => item.id === app.id ? app : item) : [...applications, app])) {
    $('#application-dialog').close();
    notify(existing ? 'Application updated.' : 'Application added. Your next chapter starts here.');
  }
});
$('#confirm-delete').addEventListener('click', () => {
  if (commit(applications.filter(app => app.id !== deletingId))) { $('#delete-dialog').close(); notify('Application deleted.'); }
});
function clearFilters() {
  $('#search').value = '';
  for (const selector of ['#status-filter', '#job-type-filter', '#work-mode-filter']) $(selector).value = 'all';
}
function showChecklist(id, clear = false) {
  if (clear) clearFilters();
  view = 'cards';
  render();
  const card = document.getElementById(`application-${id}`);
  card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card?.focus({ preventScroll: true });
}
document.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const { action, id, status } = button.dataset;
  const app = applications.find(item => item.id === id);
  if (action === 'add') openForm();
  if (action === 'clear') { clearFilters(); render(); }
  if (action === 'filter') { clearFilters(); $('#status-filter').value = status; render(); $('#applications-heading').scrollIntoView({ behavior: 'smooth' }); }
  if (action === 'edit' && app) openForm(app);
  if (action === 'delete' && app) {
    deletingId = id;
    $('#delete-error').hidden = true;
    $('#delete-description').textContent = `${app.title} at ${app.company}`;
    $('#delete-dialog').showModal();
    $('#cancel-delete').focus();
  }
  if (action === 'jump') showChecklist(id, true);
  if (action === 'checklist') showChecklist(id);
});
document.addEventListener('change', event => {
  const input = event.target, { action, id, index } = input.dataset;
  if (!['status', 'task'].includes(action)) return;
  const app = applications.find(item => item.id === id);
  if (!app) return;
  const changed = action === 'status' ? updateStatus(app, input.value) : updateTask(app, Number(index), input.checked);
  commit(applications.map(item => item.id === id ? changed : item));
  // Locate by dataset rather than interpolating stored identifiers into CSS selectors.
  const replacement = [...document.querySelectorAll('[data-action]')].find(el => el.dataset.action === action && el.dataset.id === id && (action === 'status' || el.dataset.index === index));
  if (replacement) {
    if (action === 'status') replacement.value = applications.find(item => item.id === id).status;
    else replacement.checked = applications.find(item => item.id === id).tasks[Number(index)];
    replacement.focus({ preventScroll: true });
  }
});
$('#search').addEventListener('input', render);
for (const selector of ['#status-filter', '#job-type-filter', '#work-mode-filter', '#sort']) $(selector).addEventListener('change', render);
$('#cards-view').addEventListener('click', () => { view = 'cards'; render(); });
$('#table-view').addEventListener('click', () => { view = 'table'; render(); });
$('#export').addEventListener('click', () => {
  if (!storageAvailable) { notify('Export is unavailable while saved data cannot be read. Existing storage has been preserved.', true); return; }
  const blob = new Blob([JSON.stringify({ version: SCHEMA_VERSION, applications }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url;
  link.download = `job-applications-${localDate()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify('Backup downloaded as JSON. It contains your application and contact details and is not encrypted.');
});
// Reload the latest source of truth before another tab can overwrite it with stale edits.
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  try {
    applications = readApplications(localStorage);
    storageAvailable = true;
    render();
    notify('Applications refreshed from another tab.');
    if ($('#application-dialog').open) { $('#application-dialog').close(); notify('Another tab changed your applications. Reopen the editor to use the latest details.'); }
  } catch {
    storageAvailable = false;
    notify('Saved data changed and could not be read. Changes are paused to preserve it.', true);
  }
});
let lastRenderedDate = localDate();
function refreshDate() { if (localDate() !== lastRenderedDate) { lastRenderedDate = localDate(); render(); } }
window.addEventListener('focus', refreshDate);
setInterval(refreshDate, 60000);
render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => notify('Offline caching is unavailable. Your saved applications still work while this page stays open.'));
