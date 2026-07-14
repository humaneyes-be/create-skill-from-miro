# Board to Skill

Board to Skill is a Miro Web SDK app that converts specifically named Miro frames into a downloadable SKILL ZIP file.

The app scans a board, serializes frame contents into text files, validates the required Skill files, and packages the result as `SKILL.zip`.

## What it does

- Scans either the full Miro board or one selected frame.
- Uses frame titles as output paths, such as `/SKILL.md` or `/agents/openai.yaml`.
- Converts Miro text, sticky notes, and shapes into Markdown-like text.
- Validates required Skill files before export.
- Builds a ZIP whose top-level folder is based on the `name` in `/SKILL.md` frontmatter.

## Required board structure

Create Miro frames whose titles are the file paths you want in the Skill. At minimum, the board must include:

- `/SKILL.md`
- `/agents/openai.yaml`

### `/SKILL.md`

The `/SKILL.md` frame must start with YAML frontmatter containing only `name` and `description`:

```markdown
---
name: example-skill
description: A short description of what this skill does.
---

# Example Skill

Instructions for the skill go here.
```

The `name` must use lowercase letters, numbers, and hyphens.

### `/agents/openai.yaml`

The `/agents/openai.yaml` frame must define the Skill interface metadata:

```yaml
interface:
  display_name: Example Skill
  short_description: A short description shown to users.
```

## Frame-to-file behavior

- A valid frame title becomes a file path in the generated ZIP.
- Sticky notes become Markdown bullets.
- Large text is converted into headings based on font size.
- Filled shapes are serialized as blockquotes.
- Duplicate output paths are reported as errors.
- The uncompressed Skill content and generated ZIP must each stay under 25 MB.

## Local development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build the production app:

```bash
npm run build
```

Run tests:

```bash
npm test
```

## GitHub Pages deployment

This repository includes a GitHub Actions workflow that builds the Vite app and deploys `dist/` to GitHub Pages on every push to `main`. It can also be run manually from the Actions tab.

To enable deployment:

1. Open the repository settings on GitHub.
2. Go to **Pages**.
3. Set **Source** to **GitHub Actions**.
4. Push to `main` or run the **Deploy to GitHub Pages** workflow manually.

The production build uses `/board-to-skill/` as the Vite base path when running in GitHub Actions, so assets resolve correctly from the project Pages URL.

## Project scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Starts Vite for local development. |
| `npm run build` | Type-checks and builds the production app. |
| `npm test` | Runs the Vitest test suite. |

## App icons

Upload these SVG assets when configuring the Miro app icon:

- Monochrome toolbar icon: `public/icons/monochrome.svg`
- Full-color toolbar panel and Marketplace icon: `public/icons/full-color.svg`

Both icons are square SVGs, non-empty, and under the 5000 byte upload limit. The monochrome icon uses a single solid color and no gradients.
