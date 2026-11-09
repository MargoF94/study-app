import { describe, expect, test } from 'vitest';
import { KINDLE, ORIGINAL_STYLE, SIZES, contrast, fontOption, sameStyle, sizeIndex, styleForInk } from '../src/lib/appearance';

describe('Kindle page colours are readable', () => {
  // Text needs 4.5:1 against everything it sits on (WCAG AA).
  const pairs: [string, string][] = [
    ['text', 'bg'], ['text', 'surface'], ['text', 'paper'], ['text', 'surface-2'],
    ['text', 'accent-soft'], ['text', 'ok-soft'], ['text', 'danger-soft'],
    ['text-2', 'bg'], ['text-2', 'surface'], ['text-2', 'paper'],
    ['accent', 'bg'], ['accent', 'surface'], ['accent', 'paper'], ['accent', 'accent-soft'],
    ['accent-contrast', 'accent'],
    ['ok', 'ok-soft'], ['ok', 'surface'], ['danger', 'danger-soft'], ['danger', 'surface'],
    ['warn', 'bg'], ['warn', 'surface'],
  ];
  for (const [name, theme] of Object.entries(KINDLE)) {
    test(name, () => {
      const p = theme.palette as Record<string, string>;
      const low = pairs
        .map(([fg, bg]) => ({ pair: `${fg} on ${bg}`, ratio: Math.round(contrast(p[fg], p[bg]) * 100) / 100 }))
        .filter((x) => x.ratio < 4.5);
      expect(low).toEqual([]);
    });
  }

  test('Sepia uses the commonly reported Kindle colours', () => {
    expect(KINDLE.sepia.palette.paper).toBe('#fbf0d9');
    expect(KINDLE.sepia.palette.text).toBe('#5f4b32');
  });
});

describe('fonts and sizes', () => {
  test('unknown fonts fall back to the original look', () => {
    expect(fontOption('nope').key).toBe('default');
    expect(fontOption('literata').question).toMatch(/^'Literata Variable'/);
    // The original look: serif questions, sans-serif answers.
    expect(fontOption('default').question).not.toBe(fontOption('default').body);
  });

  test('sizes snap to the nearest step', () => {
    expect(SIZES[sizeIndex(1)]).toBe(1);
    expect(SIZES[sizeIndex(1.3)]).toBe(1.28);
    expect(sizeIndex(5)).toBe(SIZES.length - 1);
  });
});

describe('handwriting keeps the text style it was written on', () => {
  const current = { font: 'literata' as const, scale: 1.17 };
  const old = { font: 'roboto' as const, scale: 1 };

  test('writing on a clean question takes the current style', () => {
    expect(styleForInk(undefined, 1, current)).toEqual(current);
    expect(styleForInk({ strokes: [] }, 2, current)).toEqual(current);
  });

  test('adding to existing handwriting keeps its style', () => {
    expect(styleForInk({ strokes: [1], style: old }, 2, current)).toEqual(old);
  });

  test('handwriting from before styles existed keeps the original look', () => {
    expect(styleForInk({ strokes: [1] }, 2, current)).toEqual(ORIGINAL_STYLE);
  });

  test('erasing everything frees the question to follow the current style', () => {
    expect(styleForInk({ strokes: [1], style: old }, 0, current)).toBeUndefined();
  });

  test('sameStyle', () => {
    expect(sameStyle(current, { font: 'literata', scale: 1.17 })).toBe(true);
    expect(sameStyle(current, old)).toBe(false);
  });
});
