import { useCallback, useEffect, useRef, useState } from 'react';
import { scanBoard } from '../core/scanBoard';
import { validateSkillFiles } from '../core/validateSkill';
import { buildSkillZip, downloadZip } from '../core/buildSkillZip';
import type { Diagnostic, DiagnosticLevel } from '../model/diagnostics';
import type { ScanResult } from '../model/scanResult';

function logDiagnostics(context: string, diagnostics: Diagnostic[]) {
  for (const diagnostic of diagnostics) {
    const target = diagnostic.framePath ? ` frame="${diagnostic.framePath}"` : '';
    const item = diagnostic.itemId ? ` item="${diagnostic.itemId}"` : '';
    const message = `[Create SKILL] ${context}: ${diagnostic.code}${target}${item} - ${diagnostic.message}`;

    if (diagnostic.level === 'error') console.error(message, diagnostic.details ?? '');
    else if (diagnostic.level === 'warning') console.warn(message, diagnostic.details ?? '');
    else console.info(message, diagnostic.details ?? '');
  }
}

function logGeneratedTextFiles(context: string, files: ScanResult['files']) {
  for (const file of files) {
    if (typeof file.content !== 'string') continue;

    console.info(`[Create SKILL] ${context}: generated ${file.path} (${file.size} bytes).`);
    console.info(`[Create SKILL] ${context}: text output for ${file.path}:
${file.content}`);
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

function diagnosticLabel(level: DiagnosticLevel): string {
  if (level === 'error') return 'Error';
  if (level === 'warning') return 'Warning';
  return 'Info';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PanelApp() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [status, setStatus] = useState('');
  const hasScanned = useRef(false);

  const runScan = useCallback(async () => {
    setStatus('Scanning board…');
    try {
      console.info('[Create SKILL] Starting board scan.');
      const scan = await scanBoard('entire');
      logGeneratedTextFiles('Frame processing result', scan.files);
      const validation = validateSkillFiles(scan.files);
      const excludedDiagnostics = scan.excludedFrames.flatMap((frame) => frame.diagnostics);
      const diagnostics = [...scan.diagnostics, ...validation.diagnostics];
      logDiagnostics('Excluded frame diagnostic', excludedDiagnostics);
      logDiagnostics('Scan diagnostic', diagnostics);
      console.info(
        `[Create SKILL] Scan finished: included=${scan.frames.length}, excluded=${scan.excludedFrames.length}, files=${scan.files.length}, errors=${diagnostics.filter((diagnostic) => diagnostic.level === 'error').length}.`,
      );
      setResult({ ...scan, diagnostics });
      setStatus('');
    } catch (e) {
      console.error('[Create SKILL] Scan failed with an unexpected error.', e);
      setStatus(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    if (hasScanned.current) return;
    hasScanned.current = true;
    void runScan();
  }, [runScan]);

  async function createAndDownload() {
    if (!result) return;

    setStatus('Validating SKILL…');
    logGeneratedTextFiles('Export validation input', result.files);
    const validation = validateSkillFiles(result.files);
    logDiagnostics('Export validation diagnostic', validation.diagnostics);

    if (validation.diagnostics.some((diagnostic) => diagnostic.level === 'error') || !validation.rootName) {
      console.error('[Create SKILL] Export blocked. Fix the listed validation errors before creating the ZIP.');
      setResult({ ...result, diagnostics: [...result.diagnostics, ...validation.diagnostics] });
      setStatus('Fix blocking errors before export.');
      return;
    }

    setStatus('Compressing ZIP…');
    const zip = await buildSkillZip(validation.rootName, result.files);
    downloadZip(zip);
    setStatus('Your SKILL download has started.');
    console.info('[Create SKILL] ZIP build and download completed successfully.');
  }

  const diagnostics = result?.diagnostics ?? [];
  const errors = diagnostics.filter((diagnostic) => diagnostic.level === 'error');
  const warnings = diagnostics.filter((diagnostic) => diagnostic.level === 'warning');
  const info = diagnostics.filter((diagnostic) => diagnostic.level === 'info');
  const hasExcludedFrames = Boolean(result?.excludedFrames.length);
  const totalBytes = result?.files.reduce((sum, file) => sum + file.size, 0) ?? 0;
  const canDownloadZip = Boolean(result) && errors.length === 0;

  return (
    <main className="panel-shell">
      {status && (
        <p className="status" role="status" aria-live="polite">
          {status}
        </p>
      )}

      {result &&
        (errors.length > 0 ? (
          <section className="notice error-notice top-notice" aria-label="Export blocked">
            <h2>Export needs attention</h2>
            <p>Fix blocking issues before creating the ZIP. Required frames include /SKILL.md and /agents/openai.yaml.</p>
          </section>
        ) : (
          <section className="notice success-notice top-notice" aria-label="Export ready">
            <h2>Ready to package</h2>
            <p>No blocking validation errors were found. Download the ZIP to create and save the Skill package.</p>
          </section>
        ))}

      <section className="actions" aria-label="Primary actions">
        <button className="primary-button" disabled={!canDownloadZip} onClick={createAndDownload} type="button">
          Download SKILL.zip
        </button>
        <button className="secondary-button" onClick={runScan} type="button">
          Rescan board
        </button>
      </section>

      {!result ? (
        <section className="card loading-card" aria-label="Scan progress">
          <span className="spinner" aria-hidden="true" />
          <div>
            <h2>Preparing export preview</h2>
            <p>We’re checking frame names and required Skill files.</p>
          </div>
        </section>
      ) : (
        <section aria-label="Miro frame export results" className="results-stack">
          <section className="summary-grid" aria-label="Export summary">
            <div className="summary-card">
              <span className="summary-value">{result.frames.length}</span>
              <span className="summary-label">Included frames</span>
            </div>
            <div className="summary-card">
              <span className="summary-value">{result.files.length}</span>
              <span className="summary-label">Files</span>
            </div>
            <div className="summary-card">
              <span className="summary-value">{formatBytes(totalBytes)}</span>
              <span className="summary-label">Uncompressed</span>
            </div>
            <div className={`summary-card ${errors.length ? 'summary-alert' : ''}`}>
              <span className="summary-value">{errors.length}</span>
              <span className="summary-label">Blocking errors</span>
            </div>
          </section>

          {diagnostics.length > 0 && (
            <section className="card" aria-labelledby="diagnostics-heading">
              <div className="section-heading">
                <h2 id="diagnostics-heading">Validation details</h2>
                <span>{errors.length} errors · {warnings.length} warnings · {info.length} info</span>
              </div>
              <ul className="diagnostic-list">
                {diagnostics.map((diagnostic, index) => (
                  <li key={`${diagnostic.code}-${diagnostic.framePath ?? diagnostic.itemId ?? index}`} className={`diagnostic-item ${diagnostic.level}`}>
                    <span className="diagnostic-badge">{diagnosticLabel(diagnostic.level)}</span>
                    <div>
                      <strong>{diagnosticUiMessage(diagnostic)}</strong>
                      {diagnostic.framePath && <span>{diagnostic.framePath}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <details className="card collapsible-card">
            <summary className="section-heading">
              <h2 id="included-heading">Included frames</h2>
              <span>{result.files.length} total</span>
            </summary>
            {result.files.length > 0 ? (
              <ul className="file-list" aria-labelledby="included-heading">
                {result.files.map((file) => (
                  <li key={file.path}>
                    <span>{file.path}</span>
                    <span>{formatBytes(file.size)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty">No exportable frames were found.</p>
            )}
          </details>

          <details className="card collapsible-card">
            <summary className="section-heading">
              <h2 id="excluded-heading">Excluded frames</h2>
              <span>{result.excludedFrames.length} skipped</span>
            </summary>
            {hasExcludedFrames ? (
              <ul className="excluded-list" aria-labelledby="excluded-heading">
                {result.excludedFrames.map((frame) => (
                  <li key={frame.id} className="excluded-frame">
                    <strong>{frame.title}</strong>
                    <span>{summarizeDiagnosticsForUi(frame.diagnostics)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty">No frames were excluded.</p>
            )}
          </details>
        </section>
      )}

      <footer className="copyright-notice" aria-label="Copyright notice">
        © 2026 HumanEyes - All Rights Reserved.
      </footer>
    </main>
  );
}
