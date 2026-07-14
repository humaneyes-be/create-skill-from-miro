import { useCallback, useEffect, useRef, useState } from 'react';
import { scanBoard } from '../core/scanBoard';
import { validateSkillFiles } from '../core/validateSkill';
import { buildSkillZip, downloadZip } from '../core/buildSkillZip';
import type { ScanResult } from '../model/scanResult';

export function PanelApp() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [status, setStatus] = useState('');
  const [blob, setBlob] = useState<Blob | null>(null);
  const hasScanned = useRef(false);

  const runScan = useCallback(async () => {
    setStatus('Scanning board');
    setBlob(null);

    try {
      const scan = await scanBoard('entire');
      const validation = validateSkillFiles(scan.files);
      setResult({ ...scan, diagnostics: [...scan.diagnostics, ...validation.diagnostics] });
      setStatus('Scan complete');
    } catch (e) {
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

    setStatus('Validating SKILL');
    const validation = validateSkillFiles(result.files);

    if (validation.diagnostics.some((diagnostic) => diagnostic.level === 'error') || !validation.rootName) {
      setResult({ ...result, diagnostics: [...result.diagnostics, ...validation.diagnostics] });
      setStatus('Fix blocking errors before export');
      return;
    }

    setStatus('Compressing ZIP');
    const zip = await buildSkillZip(validation.rootName, result.files);
    setBlob(zip);
    setStatus('Your SKILL is ready');
  }

  const errors = result?.diagnostics.filter((diagnostic) => diagnostic.level === 'error') ?? [];
  const warnings = result?.diagnostics.filter((diagnostic) => diagnostic.level === 'warning') ?? [];
  const hasExcludedFrames = Boolean(result?.excludedFrames.length);

  return (
    <main>
      <h1>Board to SKILL</h1>
      <p>Turn export frames on this board into a SKILL.</p>
      {status && <p className="status">{status}</p>}
      {result && (
        <section>
          <h2>Scan result</h2>
          {hasExcludedFrames && (
            <p className="warning notice">
              Some frames were excluded because they have errors. Rename or fix them, then reopen the plugin to rescan.
            </p>
          )}
          <dl>
            <dt>Included frames</dt>
            <dd>{result.frames.length}</dd>
            <dt>Excluded frames</dt>
            <dd>{result.excludedFrames.length}</dd>
            <dt>Content files</dt>
            <dd>{result.files.length}</dd>
            <dt>Assets</dt>
            <dd>{result.assets.length}</dd>
            <dt>Errors</dt>
            <dd>{errors.length}</dd>
            <dt>Warnings</dt>
            <dd>{warnings.length}</dd>
          </dl>
          <h3>Included frames</h3>
          <ul>{result.frames.map((frame) => <li key={frame.id}>{frame.logicalPath}</li>)}</ul>
          <h3>Excluded frames</h3>
          {hasExcludedFrames ? (
            <ul>
              {result.excludedFrames.map((frame) => (
                <li key={frame.id} className="error">
                  <strong>{frame.title}</strong>: {frame.reason}
                </li>
              ))}
            </ul>
          ) : (
            <p>No frames were excluded.</p>
          )}
          <button onClick={build} disabled={errors.length > 0}>Create SKILL.zip</button>
          {blob && <button onClick={() => downloadZip(blob)}>Download SKILL.zip</button>}
          <h3>Files</h3>
          <ul>{result.files.map((file) => <li key={file.path}>{file.path}</li>)}</ul>
          <h3>Preview</h3>
          {result.files.filter((file) => typeof file.content === 'string').map((file) => (
            <details key={file.path}>
              <summary>{file.path}</summary>
              <pre>{file.content as string}</pre>
            </details>
          ))}
          <h3>Diagnostics</h3>
          <ul>
            {result.diagnostics.map((diagnostic, index) => (
              <li key={index} className={diagnostic.level}>
                <strong>{diagnostic.code}</strong>: {diagnostic.message}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
