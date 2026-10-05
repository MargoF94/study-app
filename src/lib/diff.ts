// Word-level differences between two texts, for showing what an import changes.

export interface DiffPart {
  type: 'same' | 'del' | 'ins';
  text: string;
}

const tokens = (s: string) => s.split(/(\s+)/).filter((t) => t !== '');

export function diffWords(before: string, after: string): DiffPart[] {
  const a = tokens(before);
  const b = tokens(after);
  // Very long texts: show them as replaced rather than spend time on a precise diff.
  if (a.length * b.length > 4_000_000) {
    return [
      ...(before ? [{ type: 'del' as const, text: before }] : []),
      ...(after ? [{ type: 'ins' as const, text: after }] : []),
    ];
  }
  // Longest common subsequence table, from the end.
  const n = a.length;
  const m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  }
  const parts: DiffPart[] = [];
  const push = (type: DiffPart['type'], text: string) => {
    const last = parts[parts.length - 1];
    if (last && last.type === type) last.text += text;
    else parts.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push('same', a[i]);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) push('del', a[i++]);
    else push('ins', b[j++]);
  }
  while (i < n) push('del', a[i++]);
  while (j < m) push('ins', b[j++]);
  return tidy(parts);
}

/** Joins changes separated only by a space into one removed and one added piece, which reads better. */
function tidy(parts: DiffPart[]): DiffPart[] {
  const out: DiffPart[] = [];
  let del = '';
  let ins = '';
  const flush = () => {
    if (del) out.push({ type: 'del', text: del });
    if (ins) out.push({ type: 'ins', text: ins });
    del = ins = '';
  };
  parts.forEach((p, k) => {
    const between = k > 0 && k < parts.length - 1 && (del || ins) && parts[k + 1].type !== 'same';
    if (p.type === 'same' && between && /^\s+$/.test(p.text)) {
      del += p.text;
      ins += p.text;
    } else if (p.type === 'del') del += p.text;
    else if (p.type === 'ins') ins += p.text;
    else {
      flush();
      out.push(p);
    }
  });
  flush();
  return out;
}
