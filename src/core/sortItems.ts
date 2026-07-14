import { stripHtml } from './htmlToMarkdown';
import { warning, type Diagnostic } from '../model/diagnostics';

export interface SortableItem {
  id: string;
  type?: string;

  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;

  content?: unknown;
  text?: unknown;
  code?: unknown;
  title?: unknown;

  data?: {
    content?: unknown;
    text?: unknown;
    code?: unknown;
    language?: unknown;
    syntax?: unknown;
    [key: string]: unknown;
  };

  style?: {
    fillColor?: string;
    fillOpacity?: number;
    fontSize?: number;
    fontFamily?: string;
    textAlign?: string;
    [key: string]: unknown;
  };

  [key: string]: unknown;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function getItemSourceText(item: SortableItem): string {
  return (
    asString(item.content) ||
    asString(item.text) ||
    asString(item.code) ||
    asString(item.data?.content) ||
    asString(item.data?.text) ||
    asString(item.data?.code)
  );
}

export function hasMeaningfulContent(content?: unknown): boolean {
  if (typeof content !== 'string') {
    return false;
  }

  return stripHtml(content).trim().length > 0;
}

export function itemBounds(item: SortableItem) {
  return { left: item.x - item.width / 2, right: item.x + item.width / 2, top: item.y - item.height / 2, bottom: item.y + item.height / 2, cy: item.y };
}

const NON_CONTENT_TYPES = new Set(['connector', 'frame']);
const ASSET_TYPES = new Set(['image', 'embed', 'preview']);

export function filterExportableItems(items: SortableItem[]): SortableItem[] {
  return items.filter((item) => {
    const type = item.type ?? '';

    if (NON_CONTENT_TYPES.has(type)) {
      return false;
    }

    if (ASSET_TYPES.has(type)) {
      return true;
    }

    return hasMeaningfulContent(getItemSourceText(item));
  });
}

export function sortItemsVisually(items: SortableItem[]): { items: SortableItem[]; diagnostics: Diagnostic[] } {
  const filtered = filterExportableItems(items); const diagnostics = filtered.filter((i) => (i.rotation ?? 0) !== 0).map((i) => warning('ROTATED_ITEM', 'Rotated item exported using its unrotated bounds.', { itemId: i.id }));
  const heights = filtered.map((i) => i.height).sort((a,b)=>a-b); const median = heights[Math.floor(heights.length/2)] || 48; const tol = Math.max(12, median * .25);
  const rows: SortableItem[][] = [];
  for (const item of [...filtered].sort((a,b)=> itemBounds(a).top - itemBounds(b).top || itemBounds(a).left - itemBounds(b).left || a.id.localeCompare(b.id))) {
    const row = rows.find((r) => Math.abs(r.reduce((s,x)=>s+x.y,0)/r.length - item.y) <= tol || r.some((x) => Math.min(itemBounds(x).bottom, itemBounds(item).bottom) - Math.max(itemBounds(x).top, itemBounds(item).top) > 0));
    (row ?? rows[rows.push([])-1]).push(item);
  }
  return { items: rows.flatMap((r) => r.sort((a,b)=> itemBounds(a).left - itemBounds(b).left || itemBounds(a).top - itemBounds(b).top || a.id.localeCompare(b.id))), diagnostics };
}
