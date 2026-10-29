import { validDate, safeUrl } from './domain.js';

const LABELS = {
  company: /^(?:company(?: name)?|employer|organisation|organization|hiring company)(?:\s*[:\-–]\s*(.*))?\s*$/i,
  title: /^(?:job title|role(?: title)?|position|vacancy|title)(?:\s*[:\-–]\s*(.*))?\s*$/i,
  deadline: /^(?:application deadline|closing date|closing|deadline|apply by|applications close)(?:\s*[:\-–]\s*(.*))?\s*$/i,
  link: /^(?:job link|job url|application link|application url|apply (?:at|here|online))(?:\s*[:\-–]\s*(.*))?\s*$/i,
  location: /^(?:location|based (?:in|at)|job location)(?:\s*[:\-–]\s*(.*))?\s*$/i,
  salary: /^(?:salary(?: range)?|pay|rate|compensation|remuneration)(?:\s*[:\-–]\s*(.*))?\s*$/i,
  contact: /^(?:contact(?: details)?|recruiter|recruitment contact)(?:\s*[:\-–]\s*(.*))?\s*$/i,
  jobType: /^(?:job type|employment type|contract type)(?:\s*[:\-–]\s*(.*))?\s*$/i,
  workMode: /^(?:work(?:ing)? (?:arrangement|mode|pattern)|workplace|work mode)(?:\s*[:\-–]\s*(.*))?\s*$/i,
};
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = value => String(value).padStart(2, '0');
function dateParts(year, month, day) {
  const value = `${year}-${pad(month)}-${pad(day)}`;
  return validDate(value) ? value : '';
}
export function extractDate(text) {
  const iso = text.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) return dateParts(iso[1], iso[2], iso[3]);
  const dayFirst = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\.?\s*,?\s*(20\d{2})\b/i);
  if (dayFirst) {
    const month = MONTHS.indexOf(dayFirst[2].slice(0, 3).toLowerCase()) + 1;
    return month ? dateParts(dayFirst[3], month, dayFirst[1]) : '';
  }
  const monthFirst = text.match(/\b([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(20\d{2})\b/i);
  if (monthFirst) {
    const month = MONTHS.indexOf(monthFirst[1].slice(0, 3).toLowerCase()) + 1;
    return month ? dateParts(monthFirst[3], month, monthFirst[2]) : '';
  }
  const numeric = text.match(/\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2})\b/);
  if (!numeric) return '';
  const first = Number(numeric[1]), second = Number(numeric[2]);
  // Numeric dates where both numbers could be a month are ambiguous across locales.
  if (first <= 12 && second <= 12) return '';
  return first > 12 ? dateParts(numeric[3], second, first) : dateParts(numeric[3], first, second);
}
function oneChoice(text, choices) {
  const matches = choices.filter(([, regex]) => regex.test(text));
  return matches.length === 1 ? matches[0][0] : '';
}
function labelledValues(lines, pattern) {
  return lines.flatMap((line, index) => {
    const match = line.match(pattern);
    if (!match) return [];
    const next = lines[index + 1] || '';
    const value = (match[1] || '').trim() || (Object.values(LABELS).some(label => label.test(next)) ? '' : next.trim());
    return value ? [value] : [];
  });
}
function unique(values) {
  const found = [...new Set(values.map(value => value.trim()).filter(Boolean))];
  return found.length === 1 ? found[0] : '';
}
function bounded(value, max) { return value && value.length <= max ? value : ''; }
export function extractJobDetails(description) {
  if (typeof description !== 'string' || !description.trim()) return {};
  const lines = description.replace(/\r\n?/g, '\n').split('\n').map(line => line.trim()).filter(Boolean);
  const value = name => unique(labelledValues(lines, LABELS[name]));
  let company = bounded(value('company'), 100);
  let title = bounded(value('title'), 150);
  // An explicit "Role at Company" heading is common, while an arbitrary first line is not reliable.
  if (!company || !title) {
    const headings = lines.slice(0, 5).map(line => line.match(/^(.{3,100}?)\s+at\s+(.{2,100})$/i)).filter(Boolean);
    if (headings.length === 1) {
      title ||= bounded(headings[0][1], 150);
      company ||= bounded(headings[0][2], 100);
    }
  }
  if (!title) {
    const jobHeading = /^(?=.{3,100}$)(?!.*[.!?])(?:[\w&+/'-]+\s+){0,7}(?:engineer|developer|designer|manager|analyst|administrator|scientist|consultant|architect|officer|assistant|specialist|director|technician|coordinator|recruiter|accountant|writer|nurse|teacher|product owner)$/i;
    title = bounded(unique(lines.slice(0, 4).filter(line => jobHeading.test(line))), 150);
  }
  if (!company && title) {
    const index = lines.indexOf(title);
    const next = index >= 0 ? lines[index + 1] || '' : '';
    const parts = next.split(/\s*[·•|]\s*/).map(part => part.trim());
    if (parts.length >= 2 && parts[0] && !Object.values(LABELS).some(label => label.test(next))) company = bounded(parts[0], 100);
  }
  const deadline = extractDate(value('deadline'));
  const labelledLinks = labelledValues(lines, LABELS.link).flatMap(line => line.match(/https?:\/\/[^\s<>"']+/gi) || []);
  const allLinks = description.match(/https?:\/\/[^\s<>"']+/gi) || [];
  const linkCandidate = unique((labelledLinks.length ? labelledLinks : allLinks).map(url => url.replace(/[),.;]+$/, '')));
  const link = linkCandidate && linkCandidate.length <= 2000 ? safeUrl(linkCandidate) || '' : '';
  const jobType = oneChoice(value('jobType') || description, [
    ['Full-time', /\bfull[\s-]?time\b/i], ['Part-time', /\bpart[\s-]?time\b/i],
    ['Contract', /\bcontract(?:or)?\b/i], ['Internship', /\bintern(?:ship)?\b/i], ['Freelance', /\bfreelance\b/i],
  ]);
  const workMode = oneChoice(value('workMode') || description, [
    ['Onsite', /\bon[\s-]?site\b/i], ['Hybrid', /\bhybrid\b/i], ['Remote', /\bremote\b/i],
  ]);
  const salaryLines = lines.filter(line => line.length <= 150 && /[£$€]\s*[\d,]+/.test(line) && /\b(?:year|annual|annum|month|hour|day)\b/i.test(line));
  const salary = bounded(value('salary') || unique(salaryLines), 150);
  return Object.fromEntries(Object.entries({ company, title, deadline, link, location: bounded(value('location'), 150), salary, contact: bounded(value('contact'), 1000), jobType, workMode }).filter(([, result]) => result));
}
