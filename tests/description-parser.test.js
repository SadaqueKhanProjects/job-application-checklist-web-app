import test from 'node:test';
import assert from 'node:assert/strict';
import { extractDate, extractJobDetails } from '../src/description-parser.js';

test('extracts labelled job details without inferring status or application date', () => {
  const text = `Job title: Senior Software Engineer\nCompany: Example Ltd\nClosing date: 30 November 2027\nJob link: https://example.com/jobs/123\nLocation: London\nJob type: Full-time\nWork arrangement: Hybrid\nSalary: £60,000–£75,000 per year\nContact: recruitment@example.com`;
  assert.deepEqual(extractJobDetails(text), { company: 'Example Ltd', title: 'Senior Software Engineer', deadline: '2027-11-30', link: 'https://example.com/jobs/123', location: 'London', salary: '£60,000–£75,000 per year', contact: 'recruitment@example.com', jobType: 'Full-time', workMode: 'Hybrid' });
});
test('accepts labels on separate lines and an explicit role at company heading', () => {
  assert.deepEqual(extractJobDetails('Developer at Example Ltd\nClosing date:\n2027-12-31\nJob link:\nhttps://example.com/job'), { company: 'Example Ltd', title: 'Developer', deadline: '2027-12-31', link: 'https://example.com/job' });
});
test('leaves ambiguous, invalid and missing values blank instead of guessing', () => {
  const result = extractJobDetails('Company: One\nCompany: Two\nDeadline: 05/06/2027\nRemote or Hybrid\nFull-time or Contract\nhttps://example.com/a\nhttps://example.com/b');
  assert.deepEqual(result, {});
  assert.equal(extractDate('31 February 2027'), '');
  assert.equal(extractDate('15/11/2027'), '2027-11-15');
  assert.equal(extractDate('11/15/2027'), '2027-11-15');
  assert.equal(extractDate('June 4, 2027'), '2027-06-04');
  assert.deepEqual(extractJobDetails(''), {});
});
test('handles untrusted text and only returns HTTP links', () => {
  const result = extractJobDetails('Company: <script>alert(1)</script>\nRole: Engineer\nJob link: javascript:alert(1)');
  assert.equal(result.company, '<script>alert(1)</script>');
  assert.equal(result.link, undefined);
  assert.equal(result.title, 'Engineer');
});

test('recognises a common job board heading without inventing a deadline', () => {
  const result = extractJobDetails('Senior Software Engineer\nExample Ltd · London · Hybrid\n£60,000–£70,000 per year\nhttps://example.com/job');
  assert.deepEqual(result, { company: 'Example Ltd', title: 'Senior Software Engineer', link: 'https://example.com/job', salary: '£60,000–£70,000 per year', workMode: 'Hybrid' });
  assert.deepEqual(extractJobDetails('Job title\nData Analyst\nCompany\nExample Ltd'), { company: 'Example Ltd', title: 'Data Analyst' });
});
