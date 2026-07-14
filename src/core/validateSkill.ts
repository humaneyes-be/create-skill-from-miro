import YAML from 'yaml';
import { error, type Diagnostic } from '../model/diagnostics';
import type { ExportFile } from '../model/exportFile';

const SKILL_FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;
const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type InvalidFormatDetails = {
  output: string;
  reason: string;
};

function invalidSkillFrontmatter(message: string, output: string, reason: string): Diagnostic {
  return error('INVALID_SKILL_FRONTMATTER', message, {
    details: { output, reason } satisfies InvalidFormatDetails,
  });
}

function invalidOpenAiYaml(message: string, output: string, reason: string): Diagnostic {
  return error('INVALID_OPENAI_YAML', message, {
    details: { output, reason } satisfies InvalidFormatDetails,
  });
}

export function parseSkillFrontmatter(content: string): { name?: string; diagnostics: Diagnostic[] } {
  const match = content.match(SKILL_FRONTMATTER_RE);

  if (!match) {
    return {
      diagnostics: [
        invalidSkillFrontmatter(
          'SKILL.md must start with YAML frontmatter.',
          content,
          'The file does not begin with a YAML frontmatter block delimited by --- lines.',
        ),
      ],
    };
  }

  try {
    const data = YAML.parse(match[1]);
    const keys = Object.keys(data ?? {});
    const badKeys = keys.filter((key) => !['name', 'description'].includes(key));
    const reasons: string[] = [];

    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      reasons.push('Frontmatter must be a YAML mapping/object.');
    }

    if (badKeys.length) {
      reasons.push(`Unsupported frontmatter key(s): ${badKeys.join(', ')}.`);
    }

    if (!data?.name) {
      reasons.push('Missing required name.');
    } else if (!SKILL_NAME_RE.test(data.name)) {
      reasons.push('Name must use lowercase letters, numbers, and single hyphens only.');
    }

    if (!data?.description) {
      reasons.push('Missing required description.');
    } else if (String(data.description).trim().length < 3) {
      reasons.push('Description must be at least 3 non-whitespace characters.');
    }

    if (reasons.length) {
      return {
        name: data?.name,
        diagnostics: [
          invalidSkillFrontmatter(
            'SKILL frontmatter must contain only valid name and description.',
            content,
            reasons.join(' '),
          ),
        ],
      };
    }

    return { name: data.name, diagnostics: [] };
  } catch (e) {
    return {
      diagnostics: [
        invalidSkillFrontmatter(
          'SKILL frontmatter YAML is invalid.',
          content,
          e instanceof Error ? e.message : 'YAML parser rejected the frontmatter.',
        ),
      ],
    };
  }
}

export function validateOpenAiYaml(content: string): Diagnostic[] {
  try {
    const data = YAML.parse(content);
    const reasons: string[] = [];

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      reasons.push('YAML must parse to a mapping/object.');
    }

    if (!data?.interface?.display_name) {
      reasons.push('Missing required interface.display_name.');
    }

    if (!data?.interface?.short_description) {
      reasons.push('Missing required interface.short_description.');
    }

    if (reasons.length) {
      return [
        invalidOpenAiYaml(
          'agents/openai.yaml must define interface.display_name and interface.short_description.',
          content,
          reasons.join(' '),
        ),
      ];
    }

    return [];
  } catch (e) {
    return [
      invalidOpenAiYaml(
        'agents/openai.yaml is invalid YAML.',
        content,
        e instanceof Error ? e.message : 'YAML parser rejected agents/openai.yaml.',
      ),
    ];
  }
}

export function validateSkillFiles(
  files: ExportFile[],
  maxBytes = 25 * 1024 * 1024,
): { rootName?: string; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const skill = files.find((file) => file.path === '/SKILL.md');
  const openai = files.find((file) => file.path === '/agents/openai.yaml');

  if (!skill) diagnostics.push(error('MISSING_REQUIRED_FRAME', '/SKILL frame is required.'));
  if (!openai) diagnostics.push(error('MISSING_REQUIRED_FRAME', '/agents/openai frame is required.'));

  let rootName;

  if (skill && typeof skill.content === 'string') {
    const result = parseSkillFrontmatter(skill.content);
    rootName = result.name;
    diagnostics.push(...result.diagnostics);
  }

  if (openai && typeof openai.content === 'string') {
    diagnostics.push(...validateOpenAiYaml(openai.content));
  }

  const total = files.reduce(
    (sum, file) => sum + (typeof file.content === 'string' ? new TextEncoder().encode(file.content).byteLength : file.size),
    0,
  );

  if (total > maxBytes) {
    diagnostics.push(error('ZIP_TOO_LARGE', `Skill is ${(total / 1024 / 1024).toFixed(1)} MB. Maximum: 25 MB.`));
  }

  return { rootName, diagnostics };
}
