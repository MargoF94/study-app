// @vitest-environment jsdom
import { strToU8, zipSync } from 'fflate';
import { expect, test } from 'vitest';
import { columnIndex, isXlsx, readXlsx } from '../src/lib/import/xlsx';

// A tiny workbook built by hand: two sheets, shared strings (one with rich-text
// runs and a Japanese reading guide that must be skipped), an inline string and a number.
function workbook(): Uint8Array {
  const files: Record<string, Uint8Array> = {
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="OUTLINE" sheetId="1" r:id="rId1"/><sheet name="SET 1" sheetId="2" r:id="rId2"/></sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="/xl/worksheets/sheet2.xml"/></Relationships>`,
    ),
    'xl/sharedStrings.xml': strToU8(
      `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Q#</t></si><si><t>Question</t></si><si><r><t>Line one</t></r><r><t xml:space="preserve">&#10;line two_x000D_</t></r></si><si><t>問題</t><rPh sb="0" eb="2"><t>モンダイ</t></rPh></si></sst>`,
    ),
    'xl/worksheets/sheet1.xml': strToU8(`<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/></worksheet>`),
    'xl/worksheets/sheet2.xml': strToU8(
      `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>` +
        `<row r="2"><c r="A2" t="s"><v>0</v></c><c r="C2" t="s"><v>1</v></c></row>` +
        `<row r="3"><c r="A3"><v>1.0</v></c><c r="B3" t="inlineStr"><is><t>inline</t></is></c><c r="C3" t="s"><v>2</v></c><c r="D3" t="s"><v>3</v></c></row>` +
        `</sheetData></worksheet>`,
    ),
  };
  return zipSync(files);
}

test('reads sheets, shared and inline strings, numbers and gaps', () => {
  const bytes = workbook();
  expect(isXlsx(bytes)).toBe(true);
  const sheets = readXlsx(bytes);
  expect(sheets.map((s) => s.name)).toEqual(['OUTLINE', 'SET 1']);
  expect(sheets[0].rows).toEqual([]);
  expect(sheets[1].rows).toEqual([[], ['Q#', '', 'Question'], ['1', 'inline', 'Line one\nline two\n', '問題']]);
});

test('column letters', () => {
  expect(columnIndex('A1')).toBe(0);
  expect(columnIndex('Z9')).toBe(25);
  expect(columnIndex('AB12')).toBe(27);
});

test('not a workbook', () => {
  expect(() => readXlsx(new Uint8Array([1, 2, 3]))).toThrow(/Excel/);
});
