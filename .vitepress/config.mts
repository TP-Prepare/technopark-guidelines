// Конфиг сайта гайдлайнов. Спека: docs/superpowers/specs/2026-10-06-vitepress-site-design.md §3–4.
import { defineConfig, type MarkdownRenderer } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';
import { rks } from './rk.ts';
import { SITE_BASE } from './site.ts';
import { navItems, sidebars, unpublishedDirs } from '../scripts/site-registry.ts';
import { githubSlug } from '../scripts/slug.ts';

// rewrites не трогают относительные ссылки: [обзор](README.md) осталась бы ./README.
// Правило переписывает README.md в index.md до VitePress, тот делает из него адрес папки.
// Ссылки с протоколом и // не трогаются.
const README_LINK = /^(?![a-z][a-z\d+.-]*:|\/\/)((?:.*\/)?)README\.md([?#].*)?$/i;

function readmeLinks(md: MarkdownRenderer): void {
  md.core.ruler.push('readme_links', (state) => {
    for (const block of state.tokens) {
      for (const token of block.children ?? []) {
        const href = token.type === 'link_open' ? token.attrGet('href') : null;
        if (href) token.attrSet('href', href.replace(README_LINK, '$1index.md$2'));
      }
    }
  });
}

export default withMermaid(defineConfig({
  lang: 'ru-RU',
  title: 'Гайдлайны Технопарка',
  base: SITE_BASE,
  cleanUrls: true,
  srcExclude: [
    'docs/**',
    'CLAUDE.md',
    '.claude/**',
    'scripts/**',
    'node_modules/**',
    'tmp-mermaid/**', // копии страниц из bun run mermaid:native
    ...unpublishedDirs(rks, '.').map((dir) => `${dir}/**`),
    ...rks.map((rk) => `${rk.dir}/diagrams/**`), // схемы: JSON и PNG, не страницы
  ],
  rewrites: {
    'README.md': 'index.md',
    ...Object.fromEntries(rks.map((rk) => [`${rk.dir}/README.md`, `${rk.dir}/index.md`])),
  },
  markdown: {
    codeCopyButtonTitle: 'Копировать код',
    anchor: { slugify: githubSlug },
    config(md) {
      md.use(readmeLinks);
    },
  },
  // Настройки читаемости: сообщения не сжимаются под ширину колонки, длинные переносятся.
  mermaid: { securityLevel: 'strict', sequence: { wrap: true, useMaxWidth: false } },
  themeConfig: {
    nav: navItems(rks),
    sidebar: sidebars(rks, '.'),
    outline: { level: [2, 3], label: 'На этой странице' },
    docFooter: { prev: 'Предыдущая страница', next: 'Следующая страница' },
    skipToContentLabel: 'Перейти к содержимому',
    sidebarMenuLabel: 'Меню',
    returnToTopLabel: 'Наверх',
    darkModeSwitchLabel: 'Оформление',
    lightModeSwitchTitle: 'Светлая тема',
    darkModeSwitchTitle: 'Тёмная тема',
    langMenuLabel: 'Язык',
    notFound: {
      title: 'Страница не найдена',
      quote: 'Такой страницы нет — возможно, её переименовали.',
      linkLabel: 'Перейти на главную',
      linkText: 'На главную',
    },
    search: {
      provider: 'local',
      options: {
        translations: {
          // В VitePress 1.6.4 подсказка в поле ввода — тот же buttonText, отдельного ключа нет.
          button: { buttonText: 'Поиск', buttonAriaLabel: 'Найти в гайдлайнах' },
          modal: {
            displayDetails: 'Показать подробности',
            resetButtonTitle: 'Сбросить',
            backButtonTitle: 'Закрыть поиск',
            noResultsText: 'Ничего не найдено по запросу',
            footer: {
              selectText: 'выбрать',
              selectKeyAriaLabel: 'Enter',
              navigateText: 'перейти',
              navigateUpKeyAriaLabel: 'Стрелка вверх',
              navigateDownKeyAriaLabel: 'Стрелка вниз',
              closeText: 'закрыть',
              closeKeyAriaLabel: 'Escape',
            },
          },
        },
      },
    },
  },
}));
