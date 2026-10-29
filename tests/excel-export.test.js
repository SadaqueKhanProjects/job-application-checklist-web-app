import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32 } from 'node:zlib';
import { exportApplicationsXlsx } from '../src/excel-export.js';
import { TASKS, DETAIL_DEFAULTS } from '../src/domain.js';
const sample = overrides => ({ ...DETAIL_DEFAULTS, id: 'one', company: 'Example', title: 'Designer', deadline: '2026-11-02', link: 'https://example.com/job?a=1&b=2', status: 'In progress', tasks: TASKS.map((_, i) => i < 2), ...overrides });
function unpack(bytes) {
  const data = Buffer.from(bytes), parts = {}; let offset = 0;
  while (data.readUInt32LE(offset) === 0x04034b50) {
    const size = data.readUInt32LE(offset + 18), nameLength = data.readUInt16LE(offset + 26), extraLength = data.readUInt16LE(offset + 28);
    const name = data.subarray(offset + 30, offset + 30 + nameLength).toString();
    const start = offset + 30 + nameLength + extraLength, content = data.subarray(start, start + size);
    assert.equal(data.readUInt16LE(offset + 8), 0);
    assert.equal(crc32(content), data.readUInt32LE(offset + 14), name);
    parts[name] = content.toString(); offset = start + size;
  }
  assert.equal(data.readUInt32LE(offset), 0x02014b50);
  assert.equal(data.readUInt32LE(data.length - 22), 0x06054b50);
  assert.equal(data.readUInt32LE(data.length - 6), offset);
  assert.equal(data.readUInt16LE(data.length - 12), Object.keys(parts).length);
  return parts;
}
test('Excel export packages all applications and checklist values without mutating records', () => {
  const records = [sample({ id: 'later', company: 'Later', deadline: '2026-12-02' }), sample({ company: 'Earlier' })];
  const original = structuredClone(records), files = unpack(exportApplicationsXlsx(records));
  assert.equal(Object.keys(files).length, 11);
  assert.match(files['xl/workbook.xml'], /name="Applications"/);
  assert.match(files['xl/workbook.xml'], /name="Checklist"/);
  assert.match(files['xl/worksheets/sheet1.xml'], /r="D2"[^>]*><is><t[^>]*>Earlier/);
  assert.match(files['xl/worksheets/sheet1.xml'], /r="K2" s="2"><v>46328<\/v>/);
  assert.match(files['xl/worksheets/sheet1.xml'], /r="C2"[^>]*t="inlineStr"/);
  assert.match(files['xl/worksheets/sheet2.xml'], /r="C2"[^>]*><is><t[^>]*>Done/);
  assert.match(files['xl/worksheets/sheet2.xml'], /r="E2"[^>]*><is><t[^>]*>To do/);
  assert.match(files['xl/worksheets/sheet1.xml'], /state="frozen"/);
  assert.match(files['xl/worksheets/sheet1.xml'], /dataValidations count="3"/);
  assert.match(files['xl/tables/table1.xml'], /autoFilter ref="A1:N3"/);
  assert.deepEqual(records, original);
});
test('user values remain literal text, XML is escaped and only safe links become hyperlinks', () => {
  const files = unpack(exportApplicationsXlsx([sample({ company: '=HYPERLINK("https://example.com")', contact: 'A&B <team>\n£50,000 中文', title: '_x0041_', link: 'javascript:alert(1)' })]));
  const sheet = files['xl/worksheets/sheet1.xml'];
  assert.match(sheet, /=HYPERLINK\(&quot;https:\/\/example.com&quot;\)/);
  assert.match(sheet, /A&amp;B &lt;team&gt;\n£50,000 中文/);
  assert.match(sheet, /_x005F_x0041_/);
  assert.doesNotMatch(sheet, /<f>|<hyperlinks>/);
  assert.doesNotMatch(files['xl/worksheets/_rels/sheet1.xml.rels'], /javascript:/);
});
test('empty export has usable headers, filters and no fabricated application', () => {
  const files = unpack(exportApplicationsXlsx([]));
  assert.match(files['xl/tables/table1.xml'], /ref="A1:N2"/);
  assert.doesNotMatch(files['xl/worksheets/sheet1.xml'], /<row r="2"/);
  assert.match(files['xl/worksheets/sheet2.xml'], /Prepare for interview/);
});
test('Excel dates handle the 1900 boundary and preserve unsupported early dates as text', () => {
  const files = unpack(exportApplicationsXlsx([sample({ deadline: '1900-01-01', appliedOn: '1899-12-31' })]));
  assert.match(files['xl/worksheets/sheet1.xml'], /r="K2" s="2"><v>1<\/v>/);
  assert.match(files['xl/worksheets/sheet1.xml'], />1899-12-31<\/t>/);
});
