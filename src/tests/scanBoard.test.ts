import { describe, expect, it, vi } from 'vitest';
import { scanBoard } from '../core/scanBoard';

function frame(id: string, title: string, children: unknown[]) {
  return { id, type: 'frame', title, getChildren: vi.fn().mockResolvedValue(children) };
}

describe('scanBoard reference list', () => {
  it('appends reference links and frame summaries to SKILL.md', async () => {
    const skillFrame = frame('skill', '🤖 SKILL.md', [
      { id: 'skill-text', type: 'text', x: 0, y: 0, width: 400, height: 100, content: '---\nname: demo\ndescription: Demo skill\n---\nUse this skill.' },
    ]);
    const openaiFrame = frame('openai', '🤖 openai.yaml', [
      { id: 'openai-text', type: 'code_block', x: 0, y: 0, width: 400, height: 100, code: 'interface:\n  display_name: Demo' },
    ]);
    const referenceFrame = frame('reference', '🤖 /references/colors', [
      { id: 'summary', type: 'text', x: 0, y: 0, width: 400, height: 50, content: '<h2>Use these brand colors.</h2>' },
      { id: 'details', type: 'text', x: 0, y: 100, width: 400, height: 50, content: 'Primary color details.' },
    ]);

    (globalThis as any).miro = { board: { get: vi.fn().mockResolvedValue([skillFrame, openaiFrame, referenceFrame]) } };

    const result = await scanBoard();
    const skillFile = result.files.find((file) => file.path === '/SKILL.md');

    expect(skillFile?.content).toContain('Here is a list of important reference files you can load for more information:');
    expect(skillFile?.content).toContain('- [references/colors.md](references/colors.md): Use these brand colors.');
    expect(skillFile?.content).not.toContain('openai.yaml');
  });
});
