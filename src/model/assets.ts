export type AssetKind = 'images'|'pdfs'|'presentations'|'documents'|'spreadsheets'|'archives'|'audio'|'video'|'other';
export type AssetSourceType = 'miro-image'|'embed-url'|'preview-url';
export interface ExportAsset { id: string; sourceItemId: string; sourceFramePath: string; sourceType: AssetSourceType; name: string; title?: string; alt?: string; url?: string; mimeType: string; extension: string; kind: AssetKind; outputPath: string; bytes?: ArrayBuffer; size?: number; }
