// Reading appearance: fonts, text size and background colours.
// The app's own palettes (light/dark) live in app.css; the Kindle-style page
// colours are defined here and applied as CSS variables on <html>.

/** "default" is the app's original look: serif questions, sans-serif answers. */
export type FontKey = 'default' | 'roboto' | 'roboto-mono' | 'literata' | 'serif' | 'sans';

const JP_SANS = "'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'Yu Gothic UI', Meiryo";
const JP_SERIF = "'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif JP'";
export const SERIF = `'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, ${JP_SERIF}, serif`;
export const SANS = `system-ui, -apple-system, 'Segoe UI', Roboto, ${JP_SANS}, sans-serif`;

export interface FontOption {
  key: FontKey;
  label: string;
  /** Font for question text. */
  question: string;
  /** Font for answers, explanations and notes. */
  body: string;
}

const same = (key: FontKey, label: string, stack: string): FontOption => ({ key, label, question: stack, body: stack });

export const FONTS: FontOption[] = [
  { key: 'default', label: 'Default', question: SERIF, body: SANS },
  same('roboto', 'Roboto', `'Roboto Variable', Roboto, ${JP_SANS}, sans-serif`),
  same('roboto-mono', 'Roboto Mono', `'Roboto Mono Variable', 'Roboto Mono', ui-monospace, Menlo, Consolas, ${JP_SANS}, monospace`),
  same('literata', 'Literata', `'Literata Variable', Literata, ${JP_SERIF}, serif`),
  same('serif', 'Serif', SERIF),
  same('sans', 'Sans', SANS),
];

export function fontOption(key: string | undefined): FontOption {
  return FONTS.find((f) => f.key === key) ?? FONTS[0];
}

/** Text size steps, as a multiple of the normal size. */
export const SIZES = [0.85, 0.92, 1, 1.08, 1.17, 1.28, 1.4, 1.55, 1.7];
export const DEFAULT_SIZE = 1;

export function sizeIndex(scale: number): number {
  let best = 0;
  SIZES.forEach((s, i) => {
    if (Math.abs(s - scale) < Math.abs(SIZES[best] - scale)) best = i;
  });
  return best;
}

/** How a question's text was laid out when handwriting was put on it. */
export interface TextStyle {
  font: FontKey;
  scale: number;
  /** Page width in page units (see lib/layout). Missing = the narrow 440 page used before wide pages. */
  width?: number;
}

const NARROW = 440;

/** Handwriting made before text styles existed was written on the original look. */
export const ORIGINAL_STYLE: TextStyle = { font: 'default', scale: 1 };

export function sameStyle(a: TextStyle, b: TextStyle): boolean {
  return a.font === b.font && Math.abs(a.scale - b.scale) < 0.001 && (a.width ?? NARROW) === (b.width ?? NARROW);
}

/**
 * The style to keep with a question's handwriting after a change: the one it was written
 * with while there is any, the current one when writing starts, none once it's all erased.
 */
export function styleForInk(before: { strokes: unknown[]; style?: TextStyle } | undefined, nextStrokes: number, current: TextStyle): TextStyle | undefined {
  if (nextStrokes === 0) return undefined;
  if (before && before.strokes.length) return before.style ?? ORIGINAL_STYLE;
  return current;
}

// ---- colours ----------------------------------------------------------------

export type ThemeKey = 'system' | 'light' | 'dark' | 'white' | 'sepia' | 'green' | 'black';

export interface ThemeOption {
  key: ThemeKey;
  label: string;
  group: 'app' | 'kindle';
  /** Shown in the picker. */
  swatch: { bg: string; text: string };
}

/** The colour variables a page colour sets (the same names app.css uses). */
export type Palette = Record<
  | 'bg' | 'surface' | 'surface-2' | 'paper' | 'border' | 'text' | 'text-2'
  | 'accent' | 'accent-contrast' | 'accent-soft' | 'ok' | 'ok-soft' | 'warn' | 'danger' | 'danger-soft'
  | 'upcoming' | 'shadow' | 'hl' | 'ink-ink' | 'ink-blue' | 'ink-red' | 'ink-green' | 'ink-yellow' | 'ink-pink',
  string
>;

const LIGHT_INK = { 'ink-blue': '#2f5fa8', 'ink-red': '#b23a3a', 'ink-green': '#2f7a50', 'ink-yellow': '#f0c83c', 'ink-pink': '#e86fa8' };
const LIGHT_SHADOW = '0 1px 2px rgb(20 26 32 / 0.06), 0 2px 8px rgb(20 26 32 / 0.06)';

/**
 * Kindle's page colours. Amazon doesn't publish exact values: Sepia is the commonly
 * reported Kindle pair (#FBF0D9 page, #5F4B32 text); the others are close matches.
 * The page colour is used for the question page and cards; the space around them is a
 * shade deeper so cards stay distinct.
 */
export const KINDLE: Record<'white' | 'sepia' | 'green' | 'black', { scheme: 'light' | 'dark'; palette: Palette }> = {
  white: {
    scheme: 'light',
    palette: {
      bg: '#f3f3f3', surface: '#ffffff', 'surface-2': '#ebebeb', paper: '#ffffff', border: '#d4d4d4',
      text: '#1a1a1a', 'text-2': '#575757',
      accent: '#3d5467', 'accent-contrast': '#ffffff', 'accent-soft': '#e2e8ed',
      ok: '#2e6a45', 'ok-soft': '#e1efe5', warn: '#765716', danger: '#9a3232', 'danger-soft': '#f6e2e0',
      upcoming: '#858585', shadow: LIGHT_SHADOW, hl: 'rgb(245 205 60 / 0.5)',
      'ink-ink': '#1a1a1a', ...LIGHT_INK,
    },
  },
  sepia: {
    scheme: 'light',
    palette: {
      bg: '#f3e5c6', surface: '#fbf0d9', 'surface-2': '#eedfbd', paper: '#fbf0d9', border: '#d9c6a0',
      text: '#5f4b32', 'text-2': '#6e583d',
      accent: '#6b4f2c', 'accent-contrast': '#fbf0d9', 'accent-soft': '#ecdab4',
      ok: '#3b6436', 'ok-soft': '#e3e6c6', warn: '#6e5016', danger: '#933624', 'danger-soft': '#f3d8c2',
      upcoming: '#8c7a60', shadow: '0 1px 2px rgb(95 75 50 / 0.08), 0 2px 8px rgb(95 75 50 / 0.08)', hl: 'rgb(230 175 40 / 0.42)',
      'ink-ink': '#3b2f20', ...LIGHT_INK,
    },
  },
  green: {
    scheme: 'light',
    palette: {
      bg: '#c6ddc4', surface: '#d5e8d3', 'surface-2': '#bfd7bd', paper: '#d5e8d3', border: '#a5c2a3',
      text: '#1d2e1f', 'text-2': '#3a523c',
      accent: '#2c5735', 'accent-contrast': '#eef6ed', 'accent-soft': '#b8d4b8',
      ok: '#295f34', 'ok-soft': '#c0ddbc', warn: '#5f4612', danger: '#8a2f2c', 'danger-soft': '#e8cfc6',
      upcoming: '#5f7a61', shadow: '0 1px 2px rgb(29 46 31 / 0.08), 0 2px 8px rgb(29 46 31 / 0.08)', hl: 'rgb(240 200 50 / 0.5)',
      'ink-ink': '#1d2e1f', ...LIGHT_INK,
    },
  },
  black: {
    scheme: 'dark',
    palette: {
      bg: '#000000', surface: '#121212', 'surface-2': '#232323', paper: '#000000', border: '#363636',
      text: '#e8e8e8', 'text-2': '#a8a8a8',
      accent: '#9fb4c6', 'accent-contrast': '#000000', 'accent-soft': '#1f2a33',
      ok: '#86b69a', 'ok-soft': '#13241a', warn: '#d6b06a', danger: '#e39a9a', 'danger-soft': '#351c1c',
      upcoming: '#7a7a7a', shadow: '0 0 0 1px rgb(255 255 255 / 0.04)', hl: 'rgb(200 160 40 / 0.45)',
      'ink-ink': '#ededed', 'ink-blue': '#79a6e8', 'ink-red': '#e88a8a', 'ink-green': '#7cc79a', 'ink-yellow': '#e6c24a', 'ink-pink': '#e98bbd',
    },
  },
};

export const THEMES: ThemeOption[] = [
  { key: 'system', label: 'Match device', group: 'app', swatch: { bg: 'linear-gradient(135deg, #e8e9ea 50%, #111315 50%)', text: '#59626a' } },
  { key: 'light', label: 'Light', group: 'app', swatch: { bg: '#e8e9ea', text: '#1d2227' } },
  { key: 'dark', label: 'Dark', group: 'app', swatch: { bg: '#111315', text: '#dde2e6' } },
  { key: 'white', label: 'White', group: 'kindle', swatch: { bg: KINDLE.white.palette.paper, text: KINDLE.white.palette.text } },
  { key: 'sepia', label: 'Sepia', group: 'kindle', swatch: { bg: KINDLE.sepia.palette.paper, text: KINDLE.sepia.palette.text } },
  { key: 'green', label: 'Green', group: 'kindle', swatch: { bg: KINDLE.green.palette.paper, text: KINDLE.green.palette.text } },
  { key: 'black', label: 'Black', group: 'kindle', swatch: { bg: KINDLE.black.palette.paper, text: KINDLE.black.palette.text } },
];

export const PALETTE_KEYS = Object.keys(KINDLE.white.palette) as (keyof Palette)[];

// ---- contrast (WCAG 2) ------------------------------------------------------

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
