import { htmlToMarkdown } from './htmlToMarkdown';
import { getItemSourceText, sortItemsVisually, type SortableItem } from './sortItems';
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

function normalizedType(item: SortableItem): string {
  return String(item.type ?? '').toLowerCase().replace(/[\s_-]+/g, '');
}

function containsHtmlCodeBlock(source: string): boolean {
  return /<pre(?:\s[^>]*)?>[\s\S]*?<\/pre>/i.test(source);
}

function looksLikeCodeItem(item: SortableItem): boolean {
  const type = normalizedType(item);
  const source = getItemSourceText(item);

  if (type === 'code' || type === 'codeblock' || type === 'snippet') return true;
  if (containsHtmlCodeBlock(source)) return true;
  if (typeof item.code === 'string' || typeof item.data?.code === 'string') return true;

  return false;
}

function sanitizeLanguage(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase().replace(/^language-/, '').replace(/^lang-/, '').replace(/[^a-z0-9+#._-]/g, '');
}

function languageFromHtml(source: string): string {
  const match = source.match(/class=["'][^"']*(?:language-|lang-)([\w+#.-]+)/i);
  return sanitizeLanguage(match?.[1]);
}

function getCodeLanguage(item: SortableItem, source: string): string {
  return sanitizeLanguage(item.data?.language) || sanitizeLanguage(item.data?.syntax) || languageFromHtml(source);
}

function decodeHtmlEntities(value: string): string {
  const document = new DOMParser().parseFromString(value, 'text/html');
  return document.documentElement.textContent ?? '';
}

function codeFromHtml(source: string): string | undefined {
  const document = new DOMParser().parseFromString(source, 'text/html');
  const pre = document.querySelector('pre');
  if (!pre) return undefined;
  const code = pre.querySelector('code');
  return code?.textContent ?? pre.textContent ?? '';
}

function getRawCode(item: SortableItem, source: string): string {
  const htmlCode = codeFromHtml(source);
  if (htmlCode !== undefined) return htmlCode;
  if (typeof item.code === 'string') return item.code;
  if (typeof item.data?.code === 'string') return item.data.code;
  if (typeof item.text === 'string') return item.text;
  if (typeof item.data?.text === 'string') return item.data.text;
  if (/<[a-z][\s\S]*>/i.test(source)) return decodeHtmlEntities(source);
  return source;
}

function createCodeFence(code: string): string {
  const runs = code.match(/`+/g) ?? [];
  const longestRun = runs.reduce((longest, run) => Math.max(longest, run.length), 0);
  return '`'.repeat(Math.max(3, longestRun + 1));
}

function normalizeCodeEndings(code: string): string {
  return code.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
}

function outputShouldUseRawCode(outputPath: string): boolean {
  return /\.ya?ml$/i.test(outputPath);
}

function serializeCodeBlock(item: SortableItem, source: string, outputPath: string): string {
  const code = normalizeCodeEndings(getRawCode(item, source));
  if (outputShouldUseRawCode(outputPath)) return code;
  const language = getCodeLanguage(item, source);
  const fence = createCodeFence(code);
  return `${fence}${language}\n${code}\n${fence}`;
}

function serializeItem(item: SortableItem, outputPath: string): string {
  const source = getItemSourceText(item);

  if (looksLikeCodeItem(item)) return serializeCodeBlock(item, source, outputPath);

  const markdown = htmlToMarkdown(source);

  if (item.type === 'sticky_note' || item.type === 'stickyNote') return markdown.split('\n\n').map((paragraph, index) => index === 0 ? `- ${paragraph}` : `  ${paragraph}`).join('\n');
  if (item.type === 'shape' && item.style?.fillOpacity !== 0 && item.style?.fillColor) return `> ${markdown.replace(/\n/g, '\n> ')}`;
  return applyHeading(markdown, typeof item.style?.fontSize === 'number' ? item.style.fontSize : typeof item.fontSize === 'number' ? item.fontSize : undefined);
}

export async function serializeFrame(logicalPath: string, outputPath: string, children: unknown[], isAssetFrame = false): Promise<{ files: ExportFile[]; diagnostics: Diagnostic[] }> {
  const { items, diagnostics } = sortItemsVisually(children as SortableItem[]);
  if (isAssetFrame) return { files: [], diagnostics };

  const imageItems = items.filter((i) => i.type === 'image');
  const exportedImages = await exportMiroImages(imageItems, logicalPath);
  const imagesById = new Map(exportedImages.map((asset) => [asset.sourceItemId, asset]));

  const blocks: AssetBlock[] = items.map((i) => {
    if (i.type === 'image') {
      const asset = imagesById.get(i.id);
      if (asset) return { type: 'asset', asset };
    }

    return { type: 'text', markdown: serializeItem(i, outputPath) };
  });

  const rendered = renderAssetBlocks(blocks, outputPath);
  const content = rendered.markdown.endsWith('\n') ? rendered.markdown : `${rendered.markdown}\n`;

  return {
    files: [
      { path: outputPath, content, size: new TextEncoder().encode(content).byteLength, type: 'text' },
      ...rendered.files,
    ],
    diagnostics: [...diagnostics, ...rendered.diagnostics],
  };
}
