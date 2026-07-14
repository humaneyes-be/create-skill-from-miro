import JSZip from 'jszip';
import type { ExportFile } from '../model/exportFile';
export const MAX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024; export const MAX_ZIP_BYTES = 25 * 1024 * 1024;
export async function buildSkillZip(rootName: string, files: ExportFile[]): Promise<Blob> { const zip=new JSZip(); for(const f of files){ const safe=f.path.replace(/^\/+/, ''); if (safe.includes('..')) throw new Error('Unsafe zip path'); zip.file(`${rootName}/${safe}`, f.content as any); } const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}}); if(blob.size>MAX_ZIP_BYTES) throw new Error(`ZIP is ${(blob.size/1024/1024).toFixed(1)} MB. Maximum: 25 MB.`); return blob; }
export function downloadZip(blob: Blob) { const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='skill.zip'; a.click(); URL.revokeObjectURL(a.href); }
