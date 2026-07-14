import { parseFramePath } from './paths';
import { serializeFrame } from './serializeFrame';
import { error, type Diagnostic } from '../model/diagnostics';
import type { ExcludedFrame, ScanResult, ScannedFrame } from '../model/scanResult';

function titleFor(frame: { title?: string }): string {
  return frame.title?.trim() || '(Untitled frame)';
}

function summarizeDiagnostics(diagnostics: Diagnostic[]): string {
  return diagnostics.map((d) => d.message).join(' ');
}

const DEBUG_MIRO_ITEMS = false;

function debugMiroChildren(logicalPath: string, children: unknown[]): void {
  if (!DEBUG_MIRO_ITEMS) return;

  console.group(`[Create SKILL] Children of ${logicalPath}`);

  for (const item of children as any[]) {
    console.info('[Create SKILL] Raw child:', item);
    console.info('[Create SKILL] Child summary:', {
      id: item.id,
      type: item.type,
      keys: Object.keys(item),
      content: item.content,
      text: item.text,
      code: item.code,
      data: item.data,
      title: item.title,
      style: item.style,
    });
  }

  console.groupEnd();
}

export async function scanBoard(mode: 'entire' | 'selected' = 'entire'): Promise<ScanResult> {
  const board = (globalThis as any).miro.board;
  const raw = mode === 'selected' ? await board.getSelection() : await board.get({ type: 'frame' });

  if (mode === 'selected' && (raw.length !== 1 || raw[0].type !== 'frame')) {
    return {
      frames: [],
      excludedFrames: [],
      files: [],
      assets: [],
      diagnostics: [error('INVALID_FRAME_PATH', 'Select exactly one frame.')],
    };
  }

  const frames: ScannedFrame[] = [];
  const excludedFrames: ExcludedFrame[] = [];
  const diagnostics: Diagnostic[] = [];
  const seen = new Map<string, string>();

  for (const frame of raw) {
    const parsed = parseFramePath(frame.title ?? '');

    if (!parsed.ok) {
      const frameDiagnostics = parsed.diagnostics.map((diagnostic) => ({
        ...diagnostic,
        framePath: parsed.normalized ?? titleFor(frame),
      }));
      excludedFrames.push({
        id: frame.id,
        title: titleFor(frame),
        reason: summarizeDiagnostics(frameDiagnostics),
        diagnostics: frameDiagnostics,
      });
      continue;
    }

    if (seen.has(parsed.outputPath)) {
      const duplicate = error('DUPLICATE_OUTPUT_PATH', `Another frame already generates ${parsed.outputPath}.`, {
        framePath: parsed.logicalPath,
      });
      excludedFrames.push({
        id: frame.id,
        title: titleFor(frame),
        reason: duplicate.message,
        diagnostics: [duplicate],
      });
      continue;
    }

    seen.set(parsed.outputPath, frame.id);
    const children = await frame.getChildren();
    debugMiroChildren(parsed.logicalPath, children);
    frames.push({
      id: frame.id,
      title: frame.title,
      logicalPath: parsed.logicalPath,
      outputPath: parsed.outputPath,
      isAssetFrame: parsed.isAssetFrame,
      children,
    });
  }

  const serialized = await Promise.all(frames.map((frame) => serializeFrame(frame.logicalPath, frame.outputPath, frame.children, frame.isAssetFrame)));
  const files = serialized.flatMap((result) => result.files);
  const more = serialized.flatMap((result) => result.diagnostics);

  return { frames, excludedFrames, files, assets: [], diagnostics: [...diagnostics, ...more] };
}
