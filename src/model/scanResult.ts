import type { Diagnostic } from './diagnostics';
import type { ExportFile } from './exportFile';
import type { ExportAsset } from './assets';

export interface ScannedFrame {
  id: string;
  title: string;
  logicalPath: string;
  outputPath: string;
  isAssetFrame: boolean;
  children: unknown[];
}

export interface ExcludedFrame {
  id: string;
  title: string;
  reason: string;
  diagnostics: Diagnostic[];
}

export interface ScanResult {
  frames: ScannedFrame[];
  excludedFrames: ExcludedFrame[];
  files: ExportFile[];
  assets: ExportAsset[];
  diagnostics: Diagnostic[];
}
