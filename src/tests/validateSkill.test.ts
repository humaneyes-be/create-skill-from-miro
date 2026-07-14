import { describe, expect, it } from 'vitest';
import { validateSkillFiles } from '../core/validateSkill';

const files = [
  {
    path: '/SKILL.md',
    content: '---\nname: branding\ndescription: Brand guidance\n---\nBody',
    size: 1,
    type: 'text' as const,
  },
  {
    path: '/agents/openai.yaml',
    content: 'interface:\n  display_name: Brand\n  short_description: Help\n',
    size: 1,
    type: 'text' as const,
  },
];

describe('validateSkill', () => {
  it('accepts valid skill files', () => {
    const result = validateSkillFiles(files);
    expect(result.rootName).toBe('branding');
    expect(result.diagnostics).toHaveLength(0);
  });

  it('rejects uppercase name and invalid yaml', () => {
    const result = validateSkillFiles([
      { ...files[0], content: '---\nname: Branding\ndescription: x\n---\n' },
      { ...files[1], content: '[' },
    ]);

    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain('INVALID_SKILL_FRONTMATTER');
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain('INVALID_OPENAI_YAML');
  });

  it('includes invalid output and reasons in validation details for console logging', () => {
    const result = validateSkillFiles([
      { ...files[0], content: '---\nname: Branding\ndescription: x\n---\nBody' },
      { ...files[1], content: '[' },
    ]);

    const skillDiagnostic = result.diagnostics.find((diagnostic) => diagnostic.code === 'INVALID_SKILL_FRONTMATTER');
    const yamlDiagnostic = result.diagnostics.find((diagnostic) => diagnostic.code === 'INVALID_OPENAI_YAML');

    expect(skillDiagnostic?.details).toMatchObject({
      output: '---\nname: Branding\ndescription: x\n---\nBody',
      reason: expect.stringContaining('Name must use lowercase letters'),
    });
    expect(skillDiagnostic?.details).toMatchObject({
      reason: expect.stringContaining('Description must be at least 3'),
    });
    expect(yamlDiagnostic?.details).toMatchObject({
      output: '[',
      reason: expect.any(String),
    });
  });
});
