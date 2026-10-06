import { expect, test } from 'bun:test';
import MarkdownIt from 'markdown-it';
import { mermaidFence } from '../.vitepress/mermaid-fence.ts';

const md = new MarkdownIt().use(mermaidFence);
const src = 'sequenceDiagram\n    A->>B: "кавычки" <тег> & {{ x }}\n';

test('mermaid block becomes component with encoded code', () => {
  const html = md.render('```mermaid\n' + src + '```\n');
  expect(html.trim()).toBe(`<Mermaid code="${encodeURIComponent(src)}" />`);
  expect(html).not.toContain('{{');
  expect(decodeURIComponent(/code="([^"]*)"/.exec(html)![1]!)).toBe(src);
});
test('other fences untouched', () =>
  expect(md.render('```go\nx := 1\n```\n')).toContain('<pre><code class="language-go">'));
