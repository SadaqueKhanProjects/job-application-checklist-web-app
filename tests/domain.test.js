import test from 'node:test';
import assert from 'node:assert/strict';
import { TASKS, STATUSES, STORAGE_KEY, validDate, localDate, dayDifference, active, missingDocuments, safeUrl, readApplications, saveApplications, updateStatus, updateTask } from '../src/domain.js';
const sample = () => ({ id: 'test-1', company: 'Example', title: 'Designer', deadline: '2026-10-28', link: 'https://example.com/job', status: 'Not started', tasks: TASKS.map(() => false), createdAt: '2026-10-28T10:00:00.000Z', submittedAt: null });
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
  for (const raw of ['bad json', 'null', JSON.stringify({ version: 2, applications: [] }), JSON.stringify({ version: 1, applications: [sample(), sample()] }), JSON.stringify({ version: 1, applications: [{ ...sample(), link: 'javascript:alert(1)' }] }), JSON.stringify({ version: 1, applications: [{ ...sample(), tasks: [] }] })]) {
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
