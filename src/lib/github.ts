// Minimal GitHub REST client for the private data repo (study-data).

export interface SyncConfig {
  owner: string;
  repo: string;
  token: string;
}

export class GitHubError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function request(cfg: SyncConfig, path: string, init: RequestInit = {}, accept = 'application/vnd.github+json') {
  return fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: accept,
      Authorization: `Bearer ${cfg.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
}

async function fail(res: Response, context: string): Promise<never> {
  let detail = '';
  try {
    detail = (await res.json()).message ?? '';
  } catch {
    /* ignore */
  }
  const messages: Record<number, string> = {
    401: 'GitHub rejected the token. It may be wrong or expired — create a new one and paste it in Settings.',
    403: 'The token is not allowed to do this. Check it has "Contents: Read and write" for the data repo.',
    404: 'Repository not found. Check the owner and repo name, and that the token includes this repo.',
  };
  throw new GitHubError(messages[res.status] ?? `${context} failed (${res.status}) ${detail}`.trim(), res.status);
}

export interface RepoInfo {
  private: boolean;
  fullName: string;
}

export async function checkRepo(cfg: SyncConfig): Promise<RepoInfo> {
  const res = await request(cfg, '');
  if (!res.ok) await fail(res, 'Checking the repository');
  const data = await res.json();
  if (data.permissions && !data.permissions.push) {
    throw new GitHubError('The token can read but not write this repository. Give it "Contents: Read and write".', 403);
  }
  return { private: !!data.private, fullName: data.full_name };
}

/** Every file in the repo with its git blob sha. An empty repo has none. */
export async function listFiles(cfg: SyncConfig): Promise<Map<string, string>> {
  const res = await request(cfg, '/git/trees/HEAD?recursive=1');
  // 409: "Git Repository is empty". 404: no commits yet, or no access — tell them apart.
  if (res.status === 409) return new Map();
  if (res.status === 404) {
    await checkRepo(cfg);
    return new Map();
  }
  if (!res.ok) await fail(res, 'Listing the data files');
  const data = await res.json();
  const out = new Map<string, string>();
  for (const e of data.tree ?? []) if (e.type === 'blob') out.set(e.path, e.sha);
  return out;
}

/** A text file by its blob sha (blobs never change, so any size works the same way). */
export async function getBlobText(cfg: SyncConfig, sha: string): Promise<string> {
  const res = await request(cfg, `/git/blobs/${sha}`, {}, 'application/vnd.github.raw+json');
  if (!res.ok) await fail(res, 'Downloading data');
  return res.text();
}

/**
 * Creates or replaces a text file; `sha` is the version being replaced (undefined for a new file).
 * Throws GitHubError 409 when another device changed it first. Returns the new blob sha.
 */
export async function putText(cfg: SyncConfig, path: string, text: string, sha: string | undefined, message: string): Promise<string> {
  const res = await request(cfg, `/contents/${encodePath(path)}`, {
    method: 'PUT',
    body: JSON.stringify({ message, content: encodeBase64(text), ...(sha ? { sha } : {}) }),
  });
  if (res.status === 409 || (res.status === 422 && !sha)) {
    throw new GitHubError('Your data changed on another device while saving.', 409);
  }
  if (!res.ok) await fail(res, 'Saving data');
  const data = await res.json();
  return data.content.sha as string;
}

/** A binary file (an attached screenshot or document) by its blob sha. */
export async function getBlobBytes(cfg: SyncConfig, sha: string): Promise<Uint8Array> {
  const res = await request(cfg, `/git/blobs/${sha}`, {}, 'application/vnd.github.raw+json');
  if (!res.ok) await fail(res, 'Downloading a file');
  return new Uint8Array(await res.arrayBuffer());
}

/** Adds a binary file. Attached files never change, so they are only ever created, not replaced. */
export async function putBytes(cfg: SyncConfig, path: string, bytes: Uint8Array, message: string): Promise<string | null> {
  const res = await request(cfg, `/contents/${encodePath(path)}`, {
    method: 'PUT',
    body: JSON.stringify({ message, content: bytesToBase64(bytes) }),
  });
  // Already there (an earlier attempt that timed out): GitHub asks for the existing file's "sha".
  if (res.status === 422) {
    const detail = await res
      .clone()
      .json()
      .then((d: { message?: string }) => d.message ?? '')
      .catch(() => '');
    if (/sha/i.test(detail)) return null;
  }
  if (!res.ok) await fail(res, 'Uploading a file');
  const data = await res.json();
  return data.content.sha as string;
}

export async function deleteFile(cfg: SyncConfig, path: string, sha: string, message: string): Promise<void> {
  const res = await request(cfg, `/contents/${encodePath(path)}`, {
    method: 'DELETE',
    body: JSON.stringify({ message, sha }),
  });
  if (res.status === 404) return; // already gone
  if (!res.ok) await fail(res, 'Removing a file');
}

/** Each path segment URL-encoded (file names may contain spaces or Japanese). */
export function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

export function encodeBase64(text: string): string {
  return bytesToBase64(new TextEncoder().encode(text));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

export function decodeBase64(b64: string): string {
  const binary = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
