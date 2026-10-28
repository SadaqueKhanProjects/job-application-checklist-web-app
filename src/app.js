import { STATUSES, TASKS, active, missingDocuments, safeUrl, localDate, dayDifference, validDate, readApplications, saveApplications, updateStatus, updateTask } from './domain.js';
const $ = selector => document.querySelector(selector);
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const statusClass = status => status.toLowerCase().replaceAll(' ', '-');
const dateLabel = value => new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
let applications = [], editingId = null, deletingId = null, storageAvailable = true;
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
try { applications = readApplications(localStorage); } catch { storageAvailable = false; notify('Saved data is unavailable or unreadable. Existing data has been preserved. Enable browser storage or recover it before making changes, then reload to retry.', true); }
function commit(next) {
  if (!storageAvailable) { notify('Changes are paused to protect your saved data. Reload after restoring access to browser storage.', true); return false; }
  try { saveApplications(localStorage, next); applications = next; render(); return true; }
  catch { notify('Could not save. Your change was not applied. Free some browser storage and try again.', true); return false; }
}
function deadlineMarkup(app) {
  const days = dayDifference(app.deadline);
  const warning = active(app) && days < 0;
  const urgent = active(app) && days >= 0 && days <= 3;
  const relative = warning ? `${Math.abs(days)} day${days === -1 ? '' : 's'} overdue` : days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `Due ${dateLabel(app.deadline)}`;
  return `<span class="deadline ${warning ? 'overdue' : urgent ? 'urgent' : ''}"><span aria-hidden="true">◷</span> ${escape(active(app) ? relative : `Deadline ${dateLabel(app.deadline)}`)}</span>`;
}
function priorityRow(app, detail) {
  return `<button class="priority-row" data-action="jump" data-id="${escape(app.id)}"><span class="mini-avatar">${escape(app.company.slice(0, 1).toUpperCase())}</span><span class="priority-text"><strong>${escape(app.company)}</strong><span>${escape(app.title)}</span></span><span class="priority-detail">${detail}</span></button>`;
}
function renderDashboard() {
  $('#stats').innerHTML = STATUSES.map(status => `<button class="stat ${statusClass(status)}" data-action="filter" data-status="${escape(status)}"><span><i></i>${status}</span><strong>${applications.filter(app => app.status === status).length}</strong></button>`).join('');
  const due = applications.filter(app => active(app) && dayDifference(app.deadline) <= 7).sort((a, b) => a.deadline.localeCompare(b.deadline));
  $('#due-soon').innerHTML = due.slice(0, 3).map(app => priorityRow(app, deadlineMarkup(app))).join('') || '<p class="panel-empty">A little breathing room.<br>No deadlines in the next 7 days.</p>';
  if (due.length > 3) $('#due-soon').innerHTML += `<p class="panel-more">+${due.length - 3} more in your applications below</p>`;
  const missing = applications.filter(missingDocuments).sort((a, b) => a.deadline.localeCompare(b.deadline));
  $('#documents-count').textContent = missing.length;
  $('#documents').innerHTML = missing.slice(0, 3).map(app => priorityRow(app, `<span class="document-label">${[!app.tasks[1] && 'CV', !app.tasks[2] && 'Cover letter'].filter(Boolean).join('<br>')}</span>`)).join('') || '<p class="panel-empty">Everything is in good shape.<br>No outstanding CVs or cover letters.</p>';
  if (missing.length > 3) $('#documents').innerHTML += `<p class="panel-more">+${missing.length - 3} more in your applications below</p>`;
  const recent = applications.filter(app => app.submittedAt).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 3);
  $('#recent').innerHTML = recent.map(app => priorityRow(app, `<span class="submitted-label">${escape(new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(app.submittedAt)))}</span>`)).join('') || '<p class="panel-empty">Your next opportunity is waiting.<br>Submitted applications will appear here.</p>';
  $('#total').textContent = applications.length;
}
function render() {
  renderDashboard();
  const query = $('#search').value.trim().toLowerCase(), filter = $('#status-filter').value, sort = $('#sort').value;
  const filtered = applications.filter(app => `${app.company} ${app.title}`.toLowerCase().includes(query) && (filter === 'all' || app.status === filter));
  filtered.sort((a, b) => sort === 'company' ? a.company.localeCompare(b.company) : sort === 'newest' ? b.createdAt.localeCompare(a.createdAt) : a.deadline.localeCompare(b.deadline));
  $('#applications').innerHTML = filtered.map(app => {
    const complete = app.tasks.filter(Boolean).length;
    return `<article id="application-${escape(app.id)}" class="application-card ${active(app) && dayDifference(app.deadline) < 0 ? 'is-overdue' : ''}" tabindex="-1"><div class="card-top"><div class="company-avatar">${escape(app.company.slice(0, 2).toUpperCase())}</div><div class="card-title"><h3>${escape(app.title)}</h3><p>${escape(app.company)}</p></div><label class="status-select ${statusClass(app.status)}"><span class="sr-only">Status for ${escape(app.title)} at ${escape(app.company)}</span><select data-action="status" data-id="${escape(app.id)}">${STATUSES.map(status => `<option${status === app.status ? ' selected' : ''}>${status}</option>`).join('')}</select></label></div>
      <div class="card-meta">${deadlineMarkup(app)}<a href="${escape(safeUrl(app.link))}" target="_blank" rel="noopener noreferrer">View job <span aria-hidden="true">↗</span></a></div>
      <div class="progress-heading"><span>Application checklist</span><span>${complete} of ${TASKS.length}</span></div><progress max="${TASKS.length}" value="${complete}" aria-label="${escape(app.company)} checklist progress"></progress>
      <fieldset class="checklist"><legend class="sr-only">Checklist for ${escape(app.title)} at ${escape(app.company)}</legend>${TASKS.map((task, i) => `<label class="task ${app.tasks[i] ? 'complete' : ''}"><input type="checkbox" data-action="task" data-id="${escape(app.id)}" data-index="${i}"${app.tasks[i] ? ' checked' : ''}><span>${task}</span></label>`).join('')}</fieldset>
      <div class="card-bottom"><span>${complete === TASKS.length ? 'Every step complete. Well done!' : complete === 0 ? 'A fresh start. You’ve got this.' : 'One step at a time. Keep going.'}</span><button data-action="edit" data-id="${escape(app.id)}" class="text-button">Edit<span class="sr-only"> ${escape(app.company)}</span></button><button data-action="delete" data-id="${escape(app.id)}" class="icon-button delete-button" aria-label="Delete ${escape(app.title)} at ${escape(app.company)}">×</button></div></article>`;
  }).join('') || `<div class="empty-state"><div class="empty-icon" aria-hidden="true">✓</div><h3>${applications.length ? 'No matching applications' : 'Your next chapter starts here'}</h3><p>${applications.length ? 'Try a different search or status filter.' : 'Add your first opportunity. We’ll help you take it one step at a time.'}</p><button class="${applications.length ? 'secondary' : 'primary'}" data-action="${applications.length ? 'clear' : 'add'}">${applications.length ? 'Clear filters' : '＋ Add your first application'}</button></div>`;
}
for (const status of STATUSES) {
  $('#status-filter').add(new Option(status, status));
  $('#application-form select[name="status"]').add(new Option(status, status));
}
function openForm(app = null) {
  editingId = app?.id || null;
  const form = $('#application-form'); form.reset();
  $('#dialog-title').textContent = app ? 'Edit application' : 'Add an application';
  for (const field of ['company', 'title', 'deadline', 'link', 'status']) if (app) form.elements[field].value = app[field];
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
  fields.company = fields.company.trim(); fields.title = fields.title.trim(); fields.link = fields.link.trim();
  if (!fields.company || !fields.title || !validDate(fields.deadline) || !safeUrl(fields.link)) {
    $('#form-error').textContent = 'Enter a company, job title, valid deadline and an http:// or https:// job link.'; $('#form-error').hidden = false; return;
  }
  const existing = applications.find(app => app.id === editingId);
  const app = updateStatus({ ...(existing || { id: crypto.randomUUID(), tasks: TASKS.map(() => false), createdAt: new Date().toISOString(), submittedAt: null }), ...fields }, fields.status);
  if (commit(existing ? applications.map(item => item.id === app.id ? app : item) : [...applications, app])) { $('#application-dialog').close(); notify(existing ? 'Application updated.' : 'Application added. Your next chapter starts here.'); }
});
$('#confirm-delete').addEventListener('click', () => {
  if (commit(applications.filter(app => app.id !== deletingId))) { $('#delete-dialog').close(); notify('Application deleted.'); }
});
document.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]'); if (!button) return;
  const { action, id, status } = button.dataset;
  const app = applications.find(item => item.id === id);
  if (action === 'add') openForm();
  if (action === 'clear') { $('#search').value = ''; $('#status-filter').value = 'all'; render(); }
  if (action === 'filter') { $('#status-filter').value = status; render(); $('#applications-heading').scrollIntoView({ behavior: 'smooth' }); }
  if (action === 'edit' && app) openForm(app);
  if (action === 'delete' && app) { deletingId = id; $('#delete-error').hidden = true; $('#delete-description').textContent = `${app.title} at ${app.company}`; $('#delete-dialog').showModal(); $('#cancel-delete').focus(); }
  if (action === 'jump') { $('#search').value = ''; $('#status-filter').value = 'all'; render(); const card = document.getElementById(`application-${id}`); card?.scrollIntoView({ behavior: 'smooth', block: 'center' }); card?.focus({ preventScroll: true }); }
});
document.addEventListener('change', event => {
  const input = event.target, { action, id, index } = input.dataset;
  if (!['status', 'task'].includes(action)) return;
  const app = applications.find(item => item.id === id); if (!app) return;
  const changed = action === 'status' ? updateStatus(app, input.value) : updateTask(app, Number(index), input.checked);
  const selector = action === 'status' ? `select[data-id="${id}"]` : `input[data-id="${id}"][data-index="${index}"]`;
  if (!commit(applications.map(item => item.id === id ? changed : item))) render();
  document.querySelector(selector)?.focus({ preventScroll: true });
});
$('#search').addEventListener('input', render);
$('#status-filter').addEventListener('change', render);
$('#sort').addEventListener('change', render);
$('#export').addEventListener('click', () => {
  if (!storageAvailable) { notify('Export is unavailable while saved data cannot be read. Existing storage has been preserved.', true); return; }
  const blob = new Blob([JSON.stringify({ version: 1, applications }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `job-applications-${localDate()}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify('Backup downloaded as JSON. It contains your application details and is not encrypted.');
});
// Avoid overwriting edits made in a second tab. Read the new source of truth first.
window.addEventListener('storage', event => { if (event.key === 'job-application-checklist.v1' || event.key === null) { try { applications = readApplications(localStorage); storageAvailable = true; render(); notify('Applications refreshed from another tab.'); if ($('#application-dialog').open) { $('#application-dialog').close(); notify('Another tab changed your applications. Reopen the editor to use the latest details.'); } } catch { storageAvailable = false; notify('Saved data changed and could not be read. Changes are paused to preserve it.', true); } } });
let lastRenderedDate = localDate();
function refreshDate() { if (localDate() !== lastRenderedDate) { lastRenderedDate = localDate(); render(); } }
window.addEventListener('focus', refreshDate);
setInterval(refreshDate, 60000);
render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => notify('Offline caching is unavailable. Your saved applications still work while this page stays open.'));
