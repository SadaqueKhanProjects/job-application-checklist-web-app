import test from 'node:test';
import assert from 'node:assert/strict';
import { TASKS, STATUSES, STORAGE_KEY, validDate, localDate, dayDifference, active, missingDocuments, safeUrl, readApplications, saveApplications, updateStatus, updateTask, DETAIL_DEFAULTS, SCHEMA_VERSION, filterApplications, validateApplication } from '../src/domain.js';
const sample = () => ({ ...DETAIL_DEFAULTS, id: 'test-1', company: 'Example', title: 'Designer', deadline: '2026-10-28', link: 'https://example.com/job', status: 'Not started', tasks: TASKS.map(() => false), createdAt: '2026-10-28T10:00:00.000Z', submittedAt: null });
const memoryStorage = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };
test('dates use calendar days including DST boundaries and reject impossible dates', () => {
  assert.equal(dayDifference('2026-03-30', '2026-03-28'), 2);
  assert.equal(dayDifference('2026-10-27', '2026-10-28'), -1);
  assert.equal(dayDifference('2026-10-28', '2026-10-28'), 0);
  assert.equal(validDate('2026-02-30'), false); assert.equal(validDate('2028-02-29'), true);
  assert.equal(validDate('bad'), false); assert.equal(localDate(new Date(2026, 9, 28, 23)), '2026-10-28');
});
test('job links allow HTTP(S) and reject executable or invalid URLs', () => {
  assert.equal(safeUrl('javascript:alert(1)'), null); assert.equal(safeUrl('file:///etc/passwd'), null);
  assert.equal(safeUrl('example.com'), null); assert.equal(safeUrl('https://example.com/job'), 'https://example.com/job');
});
test('documents and overdue eligibility exclude later pipeline stages', () => {
  const app = sample(); assert.equal(missingDocuments(app), true);
  assert.equal(missingDocuments({ ...app, tasks: app.tasks.map((x, i) => i === 1 || i === 2) }), false);
  for (const status of STATUSES.slice(2)) { assert.equal(active({ ...app, status }), false); assert.equal(missingDocuments({ ...app, status }), false); }
});
test('checklist work starts progress and submission records its first timestamp', () => {
  const app = updateTask(sample(), 0, true); assert.equal(app.status, 'In progress');
  const submitted = updateTask(app, 4, true, '2026-10-28T11:00:00Z');
  assert.equal(submitted.status, 'Submitted'); assert.equal(submitted.submittedAt, '2026-10-28T11:00:00Z');
  const interview = updateStatus(submitted, 'Interview', '2026-10-29T11:00:00Z');
  assert.equal(interview.submittedAt, submitted.submittedAt); assert.equal(interview.tasks[4], true);
  const undone = updateTask(submitted, 4, false); assert.equal(undone.status, 'In progress'); assert.equal(undone.submittedAt, null);
});
test('local storage round-trips a versioned application list', () => {
  const storage = memoryStorage(); assert.deepEqual(readApplications(storage), []);
  saveApplications(storage, [sample()]); assert.deepEqual(readApplications(storage), [sample()]);
});
test('unreadable, incompatible and malformed data are preserved without reset', () => {
  for (const raw of ['bad json', 'null', JSON.stringify({ version: 99, applications: [] }), JSON.stringify({ version: 1, applications: [sample(), sample()] }), JSON.stringify({ version: 1, applications: [{ ...sample(), link: 'javascript:alert(1)' }] }), JSON.stringify({ version: 1, applications: [{ ...sample(), tasks: [] }] })]) {
    const storage = memoryStorage(); storage.setItem(STORAGE_KEY, raw);
    assert.throws(() => readApplications(storage)); assert.equal(storage.getItem(STORAGE_KEY), raw);
  }
});
test('storage write failures are surfaced to callers', () => {
  assert.throws(() => saveApplications({ setItem() { throw new Error('Quota exceeded'); } }, [sample()]), /Quota exceeded/);
});
test('moving a submitted application back to an active status resets submission', () => {
  const submitted = updateStatus(sample(), 'Submitted', '2026-10-28T11:00:00Z');
  for (const status of ['Not started', 'In progress']) {
    const restarted = updateStatus(submitted, status);
    assert.equal(restarted.tasks[4], false); assert.equal(restarted.submittedAt, null); assert.equal(active(restarted), true);
  }
});
test('v1 migration preserves existing fields, checklists and source storage', () => {
  const legacy = sample();
  for (const key of Object.keys(DETAIL_DEFAULTS)) delete legacy[key];
  legacy.status = 'Interview'; legacy.submittedAt = '2026-10-20T12:00:00.000Z'; legacy.tasks[4] = true;
  const raw = JSON.stringify({ version: 1, applications: [legacy] });
  const storage = memoryStorage(); storage.setItem(STORAGE_KEY, raw);
  const migrated = readApplications(storage);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
  assert.deepEqual(migrated[0], { ...legacy, ...DETAIL_DEFAULTS, appliedOn: '2026-10-20' });
  saveApplications(storage, migrated);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).version, SCHEMA_VERSION);
  assert.deepEqual(readApplications(storage), migrated);
});
test('new optional details round-trip and invalid metadata cannot overwrite storage', () => {
  const storage = memoryStorage();
  const app = { ...sample(), location: 'Example City', jobType: 'Contract', workMode: 'Hybrid', salary: '£450–£550 per day', stageReached: 'Final interview', contact: 'Example recruiter\ncontact@example.com' };
  saveApplications(storage, [app]); assert.deepEqual(readApplications(storage), [app]);
  const original = storage.getItem(STORAGE_KEY);
  for (const invalid of [{ jobType: 'Remote' }, { workMode: 'Contract' }, { appliedOn: '2026-02-30' }, { contact: 'x'.repeat(1001) }, { location: null }, { stageReached: 5 }]) {
    assert.equal(validateApplication({ ...app, ...invalid }), false);
    assert.throws(() => saveApplications(storage, [{ ...app, ...invalid }]));
    assert.equal(storage.getItem(STORAGE_KEY), original);
  }
});
test('expanded outcomes retain submission date and stage through rejection or withdrawal', () => {
  const applied = updateStatus({ ...sample(), stageReached: 'Final interview', appliedOn: '2026-10-15' }, 'Assessment', '2026-10-28T11:00:00Z');
  for (const status of ['Awaiting response', 'Interview', 'Offer', 'Offer accepted', 'Rejected', 'Withdrawn']) {
    const next = updateStatus(applied, status);
    assert.equal(next.appliedOn, '2026-10-15'); assert.equal(next.stageReached, 'Final interview'); assert.equal(next.submittedAt, applied.submittedAt);
  }
  assert.equal(updateStatus(applied, 'In progress').appliedOn, '');
  assert.throws(() => updateStatus(applied, 'Unknown'));
});
test('filtering searches new details, combines selections and sorts applied dates without mutation', () => {
  const a = { ...sample(), id: 'a', location: 'Example City', jobType: 'Contract', workMode: 'Remote', appliedOn: '2026-10-20' };
  const b = { ...sample(), id: 'b', company: 'Other', stageReached: 'Technical interview', workMode: 'Hybrid', appliedOn: '2026-10-25' };
  const apps = [a, b];
  assert.deepEqual(filterApplications(apps, { query: 'example city', jobType: 'Contract', workMode: 'Remote' }), [a]);
  assert.deepEqual(filterApplications(apps, { query: 'technical', status: 'Not started' }), [b]);
  assert.deepEqual(filterApplications(apps, { status: 'Submitted' }), []);
  assert.deepEqual(filterApplications(apps, { sort: 'applied' }), [b, a]); assert.deepEqual(apps, [a, b]);
});
test('malformed v2 records and duplicate IDs fail reads without changing saved contents', () => {
  const storage = memoryStorage();
  for (const applications of [[{ ...sample(), appliedOn: 'not a date' }], [{ ...sample(), contact: null }], [sample(), sample()]]) {
    const raw = JSON.stringify({ version: SCHEMA_VERSION, applications });
    storage.setItem(STORAGE_KEY, raw); assert.throws(() => readApplications(storage)); assert.equal(storage.getItem(STORAGE_KEY), raw);
  }
});
test('withdrawal before submission does not manufacture an application date', () => {
  const app = updateStatus(sample(), 'Withdrawn');
  assert.equal(app.appliedOn, ''); assert.equal(app.submittedAt, null); assert.equal(app.tasks[4], false);
});
