// What kind of thing a link points to, worked out from its address; and the exam's groups of links.
import type { Link, LinkGroup } from './types';

export type LinkKind = 'web' | 'sheet' | 'doc' | 'slides' | 'pdf' | 'drive' | 'video';

export interface LinkInfo {
  kind: LinkKind;
  /** "Google Sheets", "PDF"… */
  label: string;
  /** Short text on the badge. */
  mark: string;
  host: string;
}

const LABELS: Record<LinkKind, [string, string]> = {
  web: ['Web page', 'WEB'],
  sheet: ['Google Sheets', 'SHEET'],
  doc: ['Google Docs', 'DOC'],
  slides: ['Google Slides', 'SLIDE'],
  pdf: ['PDF', 'PDF'],
  drive: ['Google Drive', 'DRIVE'],
  video: ['Video', 'VIDEO'],
};

/** Adds https:// when it was left out ("docs.google.com/…" → "https://docs.google.com/…"). */
export function cleanUrl(input: string): string {
  const s = input.trim();
  if (!s) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return s;
  return 'https://' + s.replace(/^\/+/, '');
}

/** Only web addresses open from the app (never javascript: or other schemes). */
export function isWebUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (u.protocol === 'https:' || u.protocol === 'http:') && !!u.hostname;
  } catch {
    return false;
  }
}

export function linkInfo(url: string): LinkInfo {
  let host = '';
  let path = '';
  try {
    const u = new URL(url);
    host = u.hostname.replace(/^www\./, '');
    path = u.pathname.toLowerCase();
  } catch {
    host = url;
  }
  let kind: LinkKind = 'web';
  if (host === 'docs.google.com' || host === 'drive.google.com') {
    if (path.startsWith('/spreadsheets')) kind = 'sheet';
    else if (path.startsWith('/document')) kind = 'doc';
    else if (path.startsWith('/presentation')) kind = 'slides';
    else kind = 'drive';
  } else if (path.endsWith('.pdf')) kind = 'pdf';
  else if (/(^|\.)youtube\.com$|^youtu\.be$|(^|\.)vimeo\.com$/.test(host)) kind = 'video';
  const [label, mark] = LABELS[kind];
  return { kind, label, mark, host };
}

/** The title to show: yours, or the address without https://. */
export function linkTitle(l: { title: string; url: string }): string {
  return l.title.trim() || l.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
}

/**
 * The exam's own links (not those on questions), by group, in the groups' order; and the
 * links in no group. A link whose group was deleted (on another device, say) is in no group.
 */
export function groupLinks(links: Link[], groups: LinkGroup[]): { grouped: { group: LinkGroup; links: Link[] }[]; ungrouped: Link[] } {
  const own = links.filter((l) => !l.questionId);
  const ids = new Set(groups.map((g) => g.id));
  return {
    grouped: groups.map((group) => ({ group, links: own.filter((l) => l.groupId === group.id) })),
    ungrouped: own.filter((l) => !l.groupId || !ids.has(l.groupId)),
  };
}

/** Group names are kept short enough to fit a heading. */
export const GROUP_NAME_MAX = 80;
