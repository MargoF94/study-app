// Helpers for attached files: kinds, names, sizes. (The files themselves: attachments.svelte.ts.)

/** Largest file that can be attached (after shrinking images). */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
/** Images are shrunk to this many pixels on the long side… */
export const MAX_IMAGE_SIDE = 2560;
/** …and re-saved as JPEG when they are bigger than this. */
export const SHRINK_OVER_BYTES = 1.5 * 1024 * 1024;

/** Shown in the app as pictures. (SVG is kept as a plain file: it can carry scripts.) */
export function isImage(type: string): boolean {
  return /^image\/(png|jpe?g|gif|webp|heic|heif|bmp|avif)$/i.test(type);
}

/** iPhone and iPad photos: only Safari shows these, so they are turned into JPEG where possible. */
export function isHeic(type: string): boolean {
  return /^image\/hei[cf]$/i.test(type);
}

export function isPdf(a: { type: string; name: string }): boolean {
  return a.type === 'application/pdf' || /\.pdf$/i.test(a.name);
}

/**
 * Files the browser can show in a new tab without risk. Others (web pages, SVG, Office files…)
 * are only saved: a web page opened from here could read the app's data.
 */
export function canOpen(a: { type: string; name: string }): boolean {
  return isImage(a.type) || a.type === 'application/pdf' || a.type === 'text/plain' || a.type === 'text/csv';
}

const TYPES: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
  bmp: 'image/bmp', avif: 'image/avif', pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv', md: 'text/plain',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip',
};

/** The file's extension, from its name or else its type ("" when neither says). */
export function extensionOf(name: string, type: string): string {
  const fromName = name.match(/\.([A-Za-z0-9]{1,8})$/)?.[1];
  if (fromName) return fromName.toLowerCase();
  return Object.entries(TYPES).find(([, t]) => t === type)?.[0] ?? '';
}

/** A type for files the browser didn't label (some don't, for .docx and the like). */
export function typeOf(name: string, type: string): string {
  return type || TYPES[extensionOf(name, '')] || 'application/octet-stream';
}

/** Short label on a file's badge: PDF, DOCX, XLSX… */
export function badgeOf(name: string, type: string): string {
  return (extensionOf(name, type) || 'file').toUpperCase().slice(0, 4);
}

/** Colour group of a file's badge. */
export function kindOf(name: string, type: string): 'pdf' | 'doc' | 'sheet' | 'slides' | 'image' | 'other' {
  const ext = extensionOf(name, type);
  if (ext === 'pdf') return 'pdf';
  if (/^(docx?|rtf|pages|txt|md|odt)$/.test(ext)) return 'doc';
  if (/^(xlsx?|csv|numbers|ods)$/.test(ext)) return 'sheet';
  if (/^(pptx?|key|odp)$/.test(ext)) return 'slides';
  if (isImage(type)) return 'image';
  return 'other';
}

/** Width and height scaled down (never up) so the long side is at most `max`. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const k = Math.min(1, max / Math.max(width, height, 1));
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** A name for a pasted picture, which comes without one (or as "image.png"). */
export function pastedName(type: string, when = new Date()): string {
  const stamp = `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())} ${pad(when.getHours())}.${pad(when.getMinutes())}.${pad(when.getSeconds())}`;
  return `Pasted image ${stamp}.${extensionOf('', type) || 'png'}`;
}

/** Pasted and dropped pictures often have a made-up name ("image.png"): give them a clearer one. */
export function nameOf(file: { name: string; type: string }, when = new Date()): string {
  const name = file.name?.trim() ?? '';
  if (!name || (isImage(file.type) && /^image\.\w+$/i.test(name))) return pastedName(file.type, when);
  return name;
}

/** A converted picture's name: the same name, ending in .jpg. */
export function asJpegName(name: string): string {
  return name.replace(/\.[A-Za-z0-9]{1,8}$/, '') + '.jpg';
}
