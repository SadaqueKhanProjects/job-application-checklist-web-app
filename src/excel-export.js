import { STATUSES, JOB_TYPES, WORK_MODES, TASKS, nextStep, safeUrl, validDate } from './domain.js';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const xml = value => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
// Escape OOXML's literal escape syntax before serialization so user text round-trips.
const text = value => xml(String(value ?? '').replace(/_x[0-9a-f]{4}_/gi, match => '_x005F_' + match.slice(1)));
const column = index => String.fromCharCode(65 + index);
const stringCell = (ref, value, style = 0) => `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${text(value)}</t></is></c>`;
const numberCell = (ref, value, style) => `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
function dateCell(ref, value) {
  if (!value || !validDate(value)) return stringCell(ref, '');
  // Excel's 1900 system includes the fictitious 29 February 1900.
  const days = (Date.parse(`${value}T00:00:00Z`) - Date.UTC(1899, 11, 31)) / 86400000;
  if (days < 1) return stringCell(ref, value);
  return numberCell(ref, days + (value >= '1900-03-01' ? 1 : 0), 2);
}
const headers = ['Status', 'Stage reached', 'Date applied', 'Company', 'Role', 'Location', 'Job type', 'Salary / rate', 'Contact details', 'Work arrangement', 'Deadline', 'Job link', 'Progress at export', 'Next step at export'];
const taskHeaders = ['Company', 'Role', ...TASKS, 'Progress at export'];
const widths = [22, 24, 16, 26, 32, 22, 18, 25, 40, 21, 16, 42, 20, 32];
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
function relationships(items) {
  return `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.map(([id, type, target, external]) => `<Relationship Id="${id}" Type="${REL}/${type}" Target="${xml(target)}"${external ? ' TargetMode="External"' : ''}/>`).join('')}</Relationships>`;
}
function validation(range, options) {
  return `<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="Choose a listed value" error="Use the dropdown to select a value." sqref="${range}"><formula1>${xml('"' + options.join(',') + '"')}</formula1></dataValidation>`;
}
function table(id, name, labels, last) {
  const ref = `A1:${column(labels.length - 1)}${last}`;
  return `<table xmlns="${NS}" id="${id}" name="${name}" displayName="${name}" ref="${ref}" totalsRowShown="0"><autoFilter ref="${ref}"/><tableColumns count="${labels.length}">${labels.map((label, i) => `<tableColumn id="${i + 1}" name="${xml(label)}"/>`).join('')}</tableColumns><tableStyleInfo name="TableStyleMedium2" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>`;
}
function sheet(labels, sizes, rows, last, tail = '') {
  return `<worksheet xmlns="${NS}" xmlns:r="${REL}"><dimension ref="A1:${column(labels.length - 1)}${last}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="36"/><cols>${sizes.map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData><row r="1" ht="44" customHeight="1">${labels.map((label, i) => stringCell(`${column(i)}1`, label, 1)).join('')}</row>${rows.join('')}</sheetData>${tail}<tableParts count="1"><tablePart r:id="table"/></tableParts></worksheet>`;
}
const styles = `<styleSheet xmlns="${NS}">
<numFmts count="1"><numFmt numFmtId="164" formatCode="dd mmm yyyy"/></numFmts>
<fonts count="3"><font><sz val="11"/><color rgb="FF172B40"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><u/><sz val="11"/><color rgb="FF0F766E"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF142D43"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">${[[0,0,0],[0,1,2],[164,0,0],[9,0,0],[0,2,0]].map(([format,font,fill]) => `<xf numFmtId="${format}" fontId="${font}" fillId="${fill}" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>`).join('')}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
<dxfs count="3"><dxf><font><color rgb="FF9F1239"/></font><fill><patternFill patternType="solid"><fgColor rgb="FFFFE4E6"/><bgColor indexed="64"/></patternFill></fill></dxf><dxf><font><color rgb="FF115E59"/></font><fill><patternFill patternType="solid"><fgColor rgb="FFCCFBF1"/><bgColor indexed="64"/></patternFill></fill></dxf><dxf><font><color rgb="FF075985"/></font><fill><patternFill patternType="solid"><fgColor rgb="FFE0F2FE"/><bgColor indexed="64"/></patternFill></fill></dxf></dxfs>
</styleSheet>`;

// A small uncompressed ZIP writer keeps the fixed XLSX export browser-local,
// dependency-free and offline. It supports only the parts generated below.
function zip(files) {
  const encoder = new TextEncoder(), chunks = [], entries = [];
  let offset = 0;
  const crcTable = Array.from({ length: 256 }, (_, n) => { for (let i = 0; i < 8; i++) n = (n & 1) ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
  for (const [path, content] of Object.entries(files)) {
    const name = encoder.encode(path), data = encoder.encode(declaration + content);
    let crc = 0xffffffff;
    for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
    crc = (crc ^ 0xffffffff) >>> 0;
    const header = new Uint8Array(30 + name.length), view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x800, true); view.setUint16(12, 33, true);
    view.setUint32(14, crc, true); view.setUint32(18, data.length, true); view.setUint32(22, data.length, true); view.setUint16(26, name.length, true); header.set(name, 30);
    entries.push({ name, data, crc, offset }); chunks.push(header, data); offset += header.length + data.length;
  }
  const directoryOffset = offset;
  for (const { name, data, crc, offset: start } of entries) {
    const header = new Uint8Array(46 + name.length), view = new DataView(header.buffer);
    view.setUint32(0, 0x02014b50, true); view.setUint16(4, 20, true); view.setUint16(6, 20, true); view.setUint16(8, 0x800, true); view.setUint16(14, 33, true);
    view.setUint32(16, crc, true); view.setUint32(20, data.length, true); view.setUint32(24, data.length, true); view.setUint16(28, name.length, true); view.setUint32(42, start, true); header.set(name, 46);
    chunks.push(header); offset += header.length;
  }
  const end = new Uint8Array(22), view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true); view.setUint16(8, entries.length, true); view.setUint16(10, entries.length, true); view.setUint32(12, offset - directoryOffset, true); view.setUint32(16, directoryOffset, true);
  chunks.push(end);
  const result = new Uint8Array(offset + end.length); let cursor = 0;
  for (const chunk of chunks) { result.set(chunk, cursor); cursor += chunk.length; }
  return result;
}

export function exportApplicationsXlsx(applications) {
  if (applications.length > 100000) throw new Error('Export supports up to 100,000 applications at a time.');
  const records = [...applications].sort((a, b) => a.deadline.localeCompare(b.deadline));
  const last = Math.max(2, records.length + 1), links = [], linkRelations = [];
  const rows = records.map((app, i) => {
    const row = i + 2, link = safeUrl(app.link);
    if (link) { links.push(`<hyperlink ref="L${row}" r:id="link${row}"/>`); linkRelations.push([`link${row}`, 'hyperlink', link, true]); }
    const values = [app.status, app.stageReached, app.appliedOn, app.company, app.title, app.location, app.jobType, app.salary, app.contact, app.workMode, app.deadline, link || '', app.tasks.filter(Boolean).length / TASKS.length, nextStep(app)];
    return `<row r="${row}">${values.map((value, j) => {
      const ref = `${column(j)}${row}`;
      if (j === 2 || j === 10) return dateCell(ref, value);
      if (j === 12) return numberCell(ref, value, 3);
      return stringCell(ref, value, j === 11 && link ? 4 : 0);
    }).join('')}</row>`;
  });
  const taskRows = records.map((app, i) => `<row r="${i + 2}">${[app.company, app.title, ...app.tasks.map(done => done ? 'Done' : 'To do')].map((value, j) => stringCell(`${column(j)}${i + 2}`, value)).join('')}${numberCell(`J${i + 2}`, app.tasks.filter(Boolean).length / TASKS.length, 3)}</row>`);
  const conditional = `<conditionalFormatting sqref="K2:K${last}"><cfRule type="expression" dxfId="0" priority="1"><formula>${xml('AND(ISNUMBER($K2),$K2<TODAY(),OR($A2="Not started",$A2="In progress"))')}</formula></cfRule></conditionalFormatting><conditionalFormatting sqref="A2:A${last}"><cfRule type="expression" dxfId="1" priority="2"><formula>${xml('OR($A2="Offer",$A2="Offer accepted")')}</formula></cfRule><cfRule type="expression" dxfId="2" priority="3"><formula>${xml('OR($A2="Submitted",$A2="Awaiting response",$A2="Assessment",$A2="Interview")')}</formula></cfRule></conditionalFormatting>`;
  const files = {
    '_rels/.rels': relationships([['workbook', 'officeDocument', 'xl/workbook.xml']]),
    'xl/workbook.xml': `<workbook xmlns="${NS}" xmlns:r="${REL}"><bookViews><workbookView/></bookViews><sheets><sheet name="Applications" sheetId="1" r:id="sheet1"/><sheet name="Checklist" sheetId="2" r:id="sheet2"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': relationships([['sheet1','worksheet','worksheets/sheet1.xml'], ['sheet2','worksheet','worksheets/sheet2.xml'], ['styles','styles','styles.xml']]),
    'xl/styles.xml': styles,
    'xl/worksheets/sheet1.xml': sheet(headers, widths, rows, last, conditional + `<dataValidations count="3">${validation(`A2:A${last}`, STATUSES)}${validation(`G2:G${last}`, JOB_TYPES)}${validation(`J2:J${last}`, WORK_MODES)}</dataValidations>` + (links.length ? `<hyperlinks>${links.join('')}</hyperlinks>` : '')),
    'xl/worksheets/sheet2.xml': sheet(taskHeaders, [26,32,...TASKS.map(() => 23),14], taskRows, last, `<conditionalFormatting sqref="C2:I${last}"><cfRule type="expression" dxfId="1" priority="1"><formula>C2="Done"</formula></cfRule></conditionalFormatting><dataValidations count="1">${validation(`C2:I${last}`, ['To do', 'Done'])}</dataValidations>`),
    'xl/worksheets/_rels/sheet1.xml.rels': relationships([['table','table','../tables/table1.xml'], ...linkRelations]),
    'xl/worksheets/_rels/sheet2.xml.rels': relationships([['table','table','../tables/table2.xml']]),
    'xl/tables/table1.xml': table(1, 'Applications', headers, last),
    'xl/tables/table2.xml': table(2, 'Checklist', taskHeaders, last),
  };
  const types = { 'xl/workbook.xml':'sheet.main', 'xl/styles.xml':'styles', 'xl/worksheets/sheet1.xml':'worksheet', 'xl/worksheets/sheet2.xml':'worksheet', 'xl/tables/table1.xml':'table', 'xl/tables/table2.xml':'table' };
  files['[Content_Types].xml'] = `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${Object.entries(types).map(([path, type]) => `<Override PartName="/${path}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.${type}+xml"/>`).join('')}</Types>`;
  return zip(files);
}
