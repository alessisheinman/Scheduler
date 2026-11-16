// Excel stores many fills as "theme color N, lightened/darkened by tint". These turn them into real colors
// so the import can show her a swatch.

const ORDER = ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];

/** Theme colors from xl/theme/theme1.xml, in Excel's index order (index 0 = light 1). */
export function parseThemeColors(themeXml: string): string[] {
  return ORDER.map((tag) => {
    const m = themeXml.match(new RegExp(`<a:${tag}>\\s*<a:(?:srgbClr val|sysClr[^>]*?lastClr)="([0-9A-Fa-f]{6})"`));
    return m ? `#${m[1].toLowerCase()}` : '#cccccc';
  });
}

const hex2 = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');

/** "argb:FF0000FF" or "theme:5:-0.25" → "#rrggbb". Unknown theme slots come out light gray. */
export function colorKeyToHex(key: string, theme: string[]): string {
  const [kind, a, b] = key.split(':');
  if (kind === 'argb') return `#${a.slice(-6).toLowerCase()}`;
  const base = theme[Number(a)];
  if (!base) return '#cccccc';
  const tint = Number(b) || 0;
  const channels = [1, 3, 5].map((i) => parseInt(base.slice(i, i + 2), 16));
  const out = channels.map((c) => (tint < 0 ? c * (1 + tint) : c + (255 - c) * tint));
  return `#${out.map(hex2).join('')}`;
}
