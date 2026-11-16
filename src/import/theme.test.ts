import { expect, test } from 'vitest';
import { colorKeyToHex, parseThemeColors } from './theme';

const XML = `<a:theme><a:themeElements><a:clrScheme name="Office">
<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
<a:dk2><a:srgbClr val="1F497D"/></a:dk2>
<a:lt2><a:srgbClr val="EEECE1"/></a:lt2>
<a:accent1><a:srgbClr val="4472C4"/></a:accent1>
<a:accent2><a:srgbClr val="ED7D31"/></a:accent2>
<a:accent3><a:srgbClr val="A5A5A5"/></a:accent3>
<a:accent4><a:srgbClr val="FFC000"/></a:accent4>
<a:accent5><a:srgbClr val="5B9BD5"/></a:accent5>
<a:accent6><a:srgbClr val="70AD47"/></a:accent6>
<a:hlink><a:srgbClr val="0563C1"/></a:hlink>
<a:folHlink><a:srgbClr val="954F72"/></a:folHlink>
</a:clrScheme></a:themeElements></a:theme>`;

test('theme colors come out in Excel index order (light 1 first)', () => {
  const t = parseThemeColors(XML);
  expect(t[0]).toBe('#ffffff');
  expect(t[1]).toBe('#000000');
  expect(t[3]).toBe('#1f497d');
  expect(t[4]).toBe('#4472c4');
  expect(t).toHaveLength(12);
});

test('color keys turn into hex, applying tint', () => {
  const t = parseThemeColors(XML);
  expect(colorKeyToHex('theme:4:-0.25', t)).toBe('#335693');
  expect(colorKeyToHex('theme:4:0', t)).toBe('#4472c4');
  expect(colorKeyToHex('theme:0:0.5', ['#000000'])).toBe('#808080');
  expect(colorKeyToHex('argb:FF0000FF', t)).toBe('#0000ff');
  expect(colorKeyToHex('theme:99:0', t)).toBe('#cccccc');
});
