import type { AssetKind } from '../model/assets';
import { error, type Diagnostic } from '../model/diagnostics';

const EXT_RE = /\.[A-Za-z0-9]{1,8}$/;
const SAFE_SEGMENT = /^[\p{L}\p{N}][\p{L}\p{N} _.-]*$/u;
export type PathResult = { ok: true; logicalPath: string; outputPath: string; isAssetFrame: boolean } | { ok: false; diagnostics: Diagnostic[]; normalized?: string };

export function normalizeLogicalPath(input: string): string {
  const trimmed = input.trim().replace(/\\+/g, '/').replace(/\/+/g, '/');
  const parts: string[] = [];
  for (const part of trimmed.split('/')) {
    const p = part.trim();
    if (!p || p === '.') continue;
    parts.push(p);
  }
  return '/' + parts.join('/');
}

export function parseFramePath(title: string): PathResult {
  const normalized = normalizeLogicalPath(title);
  const diagnostics: Diagnostic[] = [];
  if (!title.trim().startsWith('/')) diagnostics.push(error('INVALID_FRAME_PATH', 'Export frame paths must start with /.'));
  if (/[?#\u0000-\u001f\u007f]/.test(title) || normalized.includes('/../') || normalized.endsWith('/..')) diagnostics.push(error('INVALID_FRAME_PATH', 'Frame path contains unsafe characters or traversal.'));
  const allowed = normalized === '/SKILL' || normalized.startsWith('/agents/') || normalized.startsWith('/references/') || normalized.startsWith('/assets/');
  if (!allowed || normalized === '/assets') diagnostics.push(error('INVALID_FRAME_PATH', 'Frame path is outside allowed roots.'));
  const badSegment = normalized.split('/').filter(Boolean).find((seg) => seg === '..' || !SAFE_SEGMENT.test(seg));
  if (badSegment) diagnostics.push(error('INVALID_FRAME_PATH', `Unsafe path segment: ${badSegment}`));
  if (normalized.split('/').some((seg) => EXT_RE.test(seg))) diagnostics.push(error('FRAME_EXTENSION_NOT_ALLOWED', `Frame names should not contain file extensions. Rename ${normalized} without the extension.`));
  if (diagnostics.length) return { ok: false, diagnostics, normalized };
  const isAssetFrame = normalized.startsWith('/assets/');
  const outputPath = normalized === '/SKILL' ? '/SKILL.md' : normalized === '/agents/openai' ? '/agents/openai.yaml' : isAssetFrame ? `${normalized}/` : `${normalized}.md`;
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
