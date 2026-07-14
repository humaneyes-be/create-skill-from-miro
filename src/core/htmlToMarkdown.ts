const allowedProtocols = new Set(['http:', 'https:', 'mailto:']);
export function stripHtml(html: string): string { const doc = new DOMParser().parseFromString(html, 'text/html'); return doc.body.textContent ?? ''; }
function clean(s: string): string { return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(); }
export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const render = (node: Node, ordered = false): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as HTMLElement; const tag = el.tagName.toLowerCase();
    const children = () => Array.from(el.childNodes).map((n) => render(n, ordered)).join('');
    if (tag === 'br') return '\n';
    if (tag === 'p' || tag === 'div') return `${clean(children())}\n\n`;
    if (tag === 'strong' || tag === 'b') return `**${children()}**`;
    if (tag === 'em' || tag === 'i') return `*${children()}*`;
    if (tag === 's') return `~~${children()}~~`;
    if (tag === 'u') return `<u>${children()}</u>`;
    if (tag === 'a') { const href = el.getAttribute('href') ?? ''; try { const u = new URL(href, 'https://example.invalid'); if (!allowedProtocols.has(u.protocol)) return children(); } catch { return children(); } return `[${children() || href}](${href})`; }
    if (tag === 'ul' || tag === 'ol') return `${Array.from(el.children).map((li, i) => `${tag === 'ol' ? `${i + 1}.` : '-'} ${clean(render(li, tag === 'ol'))}`).join('\n')}\n\n`;
    if (tag === 'li') return children();
    return children();
  };
  return clean(Array.from(doc.body.childNodes).map((n) => render(n)).join(''));
}
