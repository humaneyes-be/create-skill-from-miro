import type { AssetKind } from '../model/assets';
import { error, type Diagnostic } from '../model/diagnostics';

const EXPORT_MARKER = '🤖';
const UNSAFE_PATH_RE = /[?#\u0000-\u001f\u007f]/;
export type PathResult = { ok: true; logicalPath: string; outputPath: string; isAssetFrame: boolean } | { ok: false; diagnostics: Diagnostic[]; normalized?: string };

export function normalizeLogicalPath(input: string): string {
  const withoutMarker = input.split(EXPORT_MARKER).join('');
  const compacted = withoutMarker.replace(/\s+/g, '').replace(/\\+/g, '/').replace(/\/+/g, '/');
  const parts: string[] = [];
  for (const part of compacted.split('/')) {
    const safe = part.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_-]+/g, '');
    if (!safe || safe === '.') continue;
    parts.push(safe);
  }
  return '/' + parts.join('/');
}

export function parseFramePath(title: string): PathResult {
  const normalized = normalizeLogicalPath(title);
  const diagnostics: Diagnostic[] = [];
  if (!title.includes(EXPORT_MARKER)) diagnostics.push(error('INVALID_FRAME_PATH', 'Export frame titles must contain 🤖.'));
  if (UNSAFE_PATH_RE.test(title) || normalized.includes('/../') || normalized.endsWith('/..')) diagnostics.push(error('INVALID_FRAME_PATH', 'Frame path contains unsafe characters or traversal.'));
  if (normalized === '/') diagnostics.push(error('INVALID_FRAME_PATH', 'Frame title must include at least one safe character besides 🤖.'));
  if (normalized === '/assets') diagnostics.push(error('INVALID_FRAME_PATH', 'Asset frame path must include a subdirectory.'));
  if (diagnostics.length) return { ok: false, diagnostics, normalized };
  const isAssetFrame = normalized.startsWith('/assets/');
  const outputPath = normalized === '/SKILL' ? '/SKILL.md' : normalized === '/openai' ? '/agents/openai.yaml' : isAssetFrame ? `${normalized}/` : `${normalized}.md`;
  return { ok: true, logicalPath: normalized, outputPath, isAssetFrame };
}

export function getAssetKindDirectory(sourceLogicalPath: string, kind: AssetKind): string {
  const base = sourceLogicalPath.startsWith('/assets/') ? sourceLogicalPath : `/assets${sourceLogicalPath}`;
  return `${base.replace(/\/$/, '')}/${kind}/`;
}

export function relativeLink(fromFile: string, toFile: string): string {
  const fromParts = fromFile.split('/').filter(Boolean).slice(0, -1);
  const toParts = toFile.split('/').filter(Boolean);
  while (fromParts.length && toParts.length && fromParts[0] === toParts[0]) { fromParts.shift(); toParts.shift(); }
  return `${'../'.repeat(fromParts.length)}${toParts.join('/')}` || './';
}

export function sanitizeFileName(name: string, fallback = 'asset'): string {
  const cleaned = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/-+(?=\.)/g, '').replace(/^-+|-+$/g, '').replace(/\.\.+/g, '.');
  return cleaned || fallback;
}
