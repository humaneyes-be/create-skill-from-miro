import { htmlToMarkdown } from './htmlToMarkdown';
import { sortItemsVisually, type SortableItem } from './sortItems';
import type { ExportFile } from '../model/exportFile';
import type { Diagnostic } from '../model/diagnostics';
import { exportMiroImages } from './exportImages';
import { renderAssetBlocks, type AssetBlock } from './serializeAssets';

export const HEADING_THRESHOLDS = { h1: 40, h2: 30, h3: 22, h4: 18, maxHeadingChars: 160 };

export function applyHeading(markdown: string, fontSize?: number): string {
  const plain = markdown.replace(/[#*_`~\[\]()]/g, '').trim();
  if (!fontSize || plain.length > HEADING_THRESHOLDS.maxHeadingChars || /^[-*0-9]+[.)]/m.test(markdown)) return markdown;
  const level = fontSize >= 40 ? 1 : fontSize >= 30 ? 2 : fontSize >= 22 ? 3 : fontSize >= 18 ? 4 : 0;
  return level ? `${'#'.repeat(level)} ${plain}` : markdown;
}

function serializeTextItem(i: any): string {
  const md = htmlToMarkdown(i.content ?? i.text ?? '');
  if (i.type === 'sticky_note' || i.type === 'stickyNote') return md.split('\n\n').map((p, idx) => idx ? `  ${p}` : `- ${p}`).join('\n');
  if (i.type === 'shape' && i.style?.fillOpacity !== 0 && i.style?.fillColor) return `> ${md.replace(/\n/g, '\n> ')}`;
  return applyHeading(md, i.style?.fontSize ?? i.fontSize);
}

export async function serializeFrame(logicalPath: string, outputPath: string, children: unknown[], isAssetFrame = false): Promise<{ files: ExportFile[]; diagnostics: Diagnostic[] }> {
  const { items, diagnostics } = sortItemsVisually(children as SortableItem[]);
  if (isAssetFrame) return { files: [], diagnostics };

  const imageItems = items.filter((i: any) => i.type === 'image');
  const exportedImages = await exportMiroImages(imageItems, logicalPath);
  const imagesById = new Map(exportedImages.map((asset) => [asset.sourceItemId, asset]));

  const blocks: AssetBlock[] = items.map((i: any) => {
    if (i.type === 'image') {
      const asset = imagesById.get(i.id);
      if (asset) return { type: 'asset', asset };
    }

    return { type: 'text', markdown: serializeTextItem(i) };
  });

  const rendered = renderAssetBlocks(blocks, outputPath);
  const body = rendered.markdown;

  return {
    files: [
      { path: outputPath, content: body.endsWith('\n') ? body : body + '\n', size: new TextEncoder().encode(body).byteLength, type: 'text' },
      ...rendered.files,
    ],
    diagnostics: [...diagnostics, ...rendered.diagnostics],
  };
}
