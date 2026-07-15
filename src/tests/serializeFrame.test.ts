import { describe, expect, it } from 'vitest';
import { getFirstTextBlockSummary, serializeFrame } from '../core/serializeFrame';

describe('serializeFrame code blocks', () => {
  it('exports a code item as fenced Markdown', async () => {
    const result = await serializeFrame('/references/example', '/references/example.md', [{ id: 'code', type: 'code_block', x: 0, y: 0, width: 400, height: 200, code: 'function greet() {\n  return "Hello";\n}', data: { language: 'javascript' } }]);
    expect(result.files[0].content).toBe(['```javascript','function greet() {','  return "Hello";','}','```',''].join('\n'));
  });

  it('does not transform markdown-like code', async () => {
    const result = await serializeFrame('/references/example', '/references/example.md', [{ id: 'code', type: 'code_block', x: 0, y: 0, width: 400, height: 200, code: '- not a list\n# not a heading' }]);
    expect(result.files[0].content).toContain('- not a list\n# not a heading');
  });

  it('preserves indentation', async () => {
    const result = await serializeFrame('/references/example', '/references/example.md', [{ id: 'code', type: 'code_block', x: 0, y: 0, width: 400, height: 200, code: ['if (ready) {','  run();','}'].join('\n') }]);
    expect(result.files[0].content).toContain('if (ready) {\n  run();\n}');
  });

  it('uses raw code for yaml files', async () => {
    const result = await serializeFrame('/config', '/config.yaml', [{ id: 'code', type: 'code_block', x: 0, y: 0, width: 400, height: 200, code: 'name: test\nversion: 1' }]);
    expect(result.files[0].content).toBe('name: test\nversion: 1\n');
  });
});

describe('getFirstTextBlockSummary', () => {
  it('returns the first visual text block as a plain summary', () => {
    const summary = getFirstTextBlockSummary([
      { id: 'second', type: 'text', x: 0, y: 100, width: 300, height: 50, content: '<p>Detailed instructions</p>' },
      { id: 'first', type: 'text', x: 0, y: 0, width: 300, height: 50, content: '<h2>Short frame summary</h2>' },
    ], '/references/example.md');

    expect(summary).toBe('Short frame summary');
  });
});
