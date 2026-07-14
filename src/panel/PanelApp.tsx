import { useCallback, useEffect, useRef, useState } from 'react';
import { scanBoard } from '../core/scanBoard';
import { validateSkillFiles } from '../core/validateSkill';
import { buildSkillZip, downloadZip } from '../core/buildSkillZip';
import type { Diagnostic } from '../model/diagnostics';
import type { ScanResult } from '../model/scanResult';

function logDiagnostics(context: string, diagnostics: Diagnostic[]) {
  for (const diagnostic of diagnostics) {
    const target = diagnostic.framePath ? ` frame="${diagnostic.framePath}"` : '';
    const item = diagnostic.itemId ? ` item="${diagnostic.itemId}"` : '';
    const message = `[Board to SKILL] ${context}: ${diagnostic.code}${target}${item} - ${diagnostic.message}`;

    if (diagnostic.level === 'error') console.error(message, diagnostic.details ?? '');
    else if (diagnostic.level === 'warning') console.warn(message, diagnostic.details ?? '');
    else console.info(message, diagnostic.details ?? '');
  }
}

function diagnosticUiMessage(diagnostic: Diagnostic): string {
  if (diagnostic.code === 'INVALID_FRAME_PATH') return 'The name of this frame is invalid.';
  if (diagnostic.code === 'FRAME_EXTENSION_NOT_ALLOWED') return 'Frame names should not include file extensions.';
  if (diagnostic.code === 'DUPLICATE_OUTPUT_PATH') return 'Another frame uses the same export path.';
  return diagnostic.message;
}

function summarizeDiagnosticsForUi(diagnostics: Diagnostic[]): string {
  return [...new Set(diagnostics.map(diagnosticUiMessage))].join(' ');
}

export function PanelApp() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [status, setStatus] = useState('');
  const [blob, setBlob] = useState<Blob | null>(null);
  const hasScanned = useRef(false);

  const runScan = useCallback(async () => {
    setStatus('Scanning board…');
    setBlob(null);

    try {
      console.info('[Board to SKILL] Starting board scan.');
      const scan = await scanBoard('entire');
      const validation = validateSkillFiles(scan.files);
      const excludedDiagnostics = scan.excludedFrames.flatMap((frame) => frame.diagnostics);
      const diagnostics = [...scan.diagnostics, ...validation.diagnostics];
      logDiagnostics('Excluded frame diagnostic', excludedDiagnostics);
      logDiagnostics('Scan diagnostic', diagnostics);
      console.info(
        `[Board to SKILL] Scan finished: included=${scan.frames.length}, excluded=${scan.excludedFrames.length}, files=${scan.files.length}, errors=${diagnostics.filter((diagnostic) => diagnostic.level === 'error').length}.`,
      );
      setResult({ ...scan, diagnostics });
      setStatus('');
    } catch (e) {
      console.error('[Board to SKILL] Scan failed with an unexpected error.', e);
      setStatus(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    if (hasScanned.current) return;
    hasScanned.current = true;
    void runScan();
  }, [runScan]);

  async function build() {
    if (!result) return;

    setStatus('Validating SKILL…');
    const validation = validateSkillFiles(result.files);
    logDiagnostics('Export validation diagnostic', validation.diagnostics);

    if (validation.diagnostics.some((diagnostic) => diagnostic.level === 'error') || !validation.rootName) {
      console.error('[Board to SKILL] Export blocked. Fix the listed validation errors before creating the ZIP.');
      setResult({ ...result, diagnostics: [...result.diagnostics, ...validation.diagnostics] });
      setStatus('Fix blocking errors before export.');
      return;
    }

    setStatus('Compressing ZIP…');
    const zip = await buildSkillZip(validation.rootName, result.files);
    setBlob(zip);
    setStatus('Your SKILL is ready.');
    console.info('[Board to SKILL] ZIP build completed successfully.');
  }

  const errors = result?.diagnostics.filter((diagnostic) => diagnostic.level === 'error') ?? [];
  const hasExcludedFrames = Boolean(result?.excludedFrames.length);
  const hasExcludedFrameErrors = Boolean(
    result?.excludedFrames.some((frame) => frame.diagnostics.some((diagnostic) => diagnostic.level === 'error')),
  );

  return (
    <main>
      {status && <p className="status">{status}</p>}
      {result && (
        <section aria-label="Board frame export results">
          <h2>Included frames ({result.frames.length})</h2>
          {result.frames.length ? (
            <ul>{result.frames.map((frame) => <li key={frame.id}>{frame.logicalPath}</li>)}</ul>
          ) : (
            <p className="empty">No frames are ready to export.</p>
          )}

          <h2>Excluded frames ({result.excludedFrames.length})</h2>
          {hasExcludedFrames ? (
            <ul>
              {result.excludedFrames.map((frame) => (
                <li key={frame.id} className="error frame-error">
                  <strong>{frame.title}</strong>
                  <span>{summarizeDiagnosticsForUi(frame.diagnostics)}</span>
                  <small>
                    {frame.diagnostics.map((diagnostic) => diagnostic.code).join(', ')}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">No frames were excluded.</p>
          )}

          {hasExcludedFrameErrors && (
            <p className="warning notice warning-notice">
              Some frames have problems and will not be exported. You can still create the ZIP, but not everything might
              be exported.
            </p>
          )}

          {errors.length > 0 && (
            <p className="error notice">
              The ZIP cannot be created yet. Make sure required frames like /SKILL and /agents/openai are included and
              valid.
            </p>
          )}

          <button onClick={build}>Create SKILL.zip</button>
          {blob && <button onClick={() => downloadZip(blob)}>Download SKILL.zip</button>}
        </section>
      )}
    </main>
  );
}
