export interface ExportFile { path: string; content: string | ArrayBuffer; size: number; type: 'text' | 'asset' | 'manifest' | 'readme'; }
