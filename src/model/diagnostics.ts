export type DiagnosticLevel = 'error' | 'warning' | 'info';
export type DiagnosticCode =
  | 'FRAME_EXTENSION_NOT_ALLOWED' | 'UNSUPPORTED_MIRO_DOCUMENT' | 'EXTERNAL_ASSET_DOWNLOAD_FAILED'
  | 'EXTERNAL_LINK_PRESERVED' | 'ASSET_KIND_UNKNOWN' | 'ASSET_GROUP_COLLAPSED'
  | 'ASSET_NAME_GENERATED' | 'ASSET_BATCH_CREATED' | 'DUPLICATE_OUTPUT_PATH'
  | 'INVALID_FRAME_PATH' | 'MISSING_REQUIRED_FRAME' | 'INVALID_SKILL_FRONTMATTER'
  | 'INVALID_OPENAI_YAML' | 'ZIP_TOO_LARGE' | 'ROTATED_ITEM' | 'ASSET_TOO_LARGE';
export interface Diagnostic { level: DiagnosticLevel; code: DiagnosticCode; message: string; framePath?: string; itemId?: string; details?: unknown }
export const error = (code: DiagnosticCode, message: string, extra: Partial<Diagnostic> = {}): Diagnostic => ({ level: 'error', code, message, ...extra });
export const warning = (code: DiagnosticCode, message: string, extra: Partial<Diagnostic> = {}): Diagnostic => ({ level: 'warning', code, message, ...extra });
