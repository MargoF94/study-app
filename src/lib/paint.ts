// Applies the reading appearance to the page: page colour, font and text size.
// The result is also kept on this device so index.html can paint it before the
// app has loaded, without a flash of the default colours.
import { KINDLE, PALETTE_KEYS, fontOption, type ThemeKey } from './appearance';

export const PAINT_KEY = 'study-log:paint';

export function applyAppearance(theme: ThemeKey, font: string | undefined, scale: number): void {
  const root = document.documentElement;
  const kindle = theme in KINDLE ? KINDLE[theme as keyof typeof KINDLE] : null;
  // Kindle colours sit on top of the app's light or dark palette (for anything they don't set).
  const dataTheme = kindle ? kindle.scheme : theme === 'system' ? '' : theme;
  if (dataTheme) root.dataset.theme = dataTheme;
  else delete root.dataset.theme;

  const vars: Record<string, string> = {};
  if (kindle) for (const k of PALETTE_KEYS) vars[`--${k}`] = kindle.palette[k];
  const f = fontOption(font);
  vars['--read-q'] = f.question;
  vars['--read-body'] = f.body;
  vars['--read-scale'] = String(scale);

  for (const k of PALETTE_KEYS) root.style.removeProperty(`--${k}`);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);

  // The browser's bar follows the app's top bar.
  const meta = document.querySelector('meta[name="theme-color"]');
  const surface = getComputedStyle(root).getPropertyValue('--surface').trim();
  if (meta && surface) meta.setAttribute('content', surface);

  try {
    localStorage.setItem(PAINT_KEY, JSON.stringify({ theme: dataTheme, vars }));
  } catch {
    /* private mode: the app still paints once it has loaded */
  }
}
