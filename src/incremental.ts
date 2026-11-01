/** Incremental deployment snapshot. Only successfully uploaded files become tracked. */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export type Snapshot = Record<string, string>;
export interface Plan { upload: string[]; remove: string[]; unchanged: number; }
export function ignored(relative: string, patterns: string[]): boolean {
  const parts = relative.split('/');
  return parts.some(part => patterns.some(pattern => {
    if (pattern.startsWith('*')) return part.endsWith(pattern.slice(1));
    return part === pattern;
  }));
}
export function hashFile(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
export function scan(root: string, ignore: string[]): Snapshot {
  const result: Snapshot = {};
  function visit(dir: string): void {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const full = path.join(dir, entry.name);
      const relative = path.relative(root, full).split(path.sep).join('/');
      if (ignored(relative, ignore)) continue;
      if (entry.isSymbolicLink()) continue; // Never follow links outside deployment root.
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) result[relative] = hashFile(full);
    }
  }
  visit(root);
  return result;
}
export function planChanges(current: Snapshot, previous: Snapshot, ignore: string[]): Plan {
  const upload = Object.keys(current).filter(p => current[p] !== previous[p]).sort();
  const remove = Object.keys(previous).filter(p => !(p in current) && !ignored(p, ignore)).sort();
  return {upload, remove, unchanged: Object.keys(current).length - upload.length};
}
export function readSnapshot(file: string): Snapshot {
  if (!fs.existsSync(file)) return {};
  const data: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid deployment manifest');
  const result: Snapshot = {};
  for (const [key, value] of Object.entries(data)) {
    if (!safeRelative(key) || typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new Error('Invalid deployment manifest entry');
    result[key] = value;
  }
  return result;
}
export function safeRelative(p: string): boolean {
  return !!p && !p.startsWith('/') && !p.includes('\\') && p.split('/').every(x => x !== '..' && x !== '.' && x !== '');
}
export function saveSnapshot(file: string, state: Snapshot): void {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n', {mode: 0o600});
    fs.renameSync(tmp, file);
  } finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
}

/**
 * Mark only the exact, currently scanned file versions as already deployed.
 * A subsequent content change will automatically make the file eligible again.
 * The caller is responsible for verifying the scan against the user's preview.
 */
export function acknowledgeVersions(previous: Snapshot, current: Snapshot, selected: string[]): Snapshot {
  const next = {...previous};
  for (const rel of selected) {
    if (!safeRelative(rel) || !Object.prototype.hasOwnProperty.call(current, rel)) {
      throw new Error(`Invalid or missing queue item: ${rel}`);
    }
    next[rel] = current[rel];
  }
  return next;
}

/** Create a recoverable pre-mutation backup; never overwrite an existing backup. */
export function backupSnapshot(file: string): string | undefined {
  if (!fs.existsSync(file)) return undefined;
  const backup = `${file}.${new Date().toISOString().replace(/[:.]/g, '-')}.${crypto.randomBytes(4).toString('hex')}.bak`;
  fs.copyFileSync(file, backup, fs.constants.COPYFILE_EXCL);
  return backup;
}
