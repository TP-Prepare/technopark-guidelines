import type MarkdownIt from 'markdown-it';

// Блок ```mermaid превращается в компонент <Mermaid>. Код уезжает в атрибут через
// encodeURIComponent: кавычки, <, & и {{ }} не доходят ни до HTML, ни до шаблона Vue.
export function mermaidFence(md: Pick<MarkdownIt, 'renderer'>): void {
  const fallback = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]!;
    if (token.info.trim().split(/\s+/)[0] === 'mermaid') {
      return `<Mermaid code="${encodeURIComponent(token.content)}" />\n`;
    }
    return fallback
      ? fallback(tokens, idx, options, env, self)
      : self.renderToken(tokens, idx, options);
  };
}
