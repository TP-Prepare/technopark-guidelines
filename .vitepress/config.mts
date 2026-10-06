// Конфиг сайта гайдлайнов. Спека: docs/superpowers/specs/2026-10-06-vitepress-site-design.md §3–4.
import { defineConfig, type MarkdownRenderer } from 'vitepress';
import { rks } from './rk.ts';
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

export default defineConfig({
  lang: 'ru-RU',
  title: 'Гайдлайны Технопарка',
  base: '/technopark-guidelines/',
  cleanUrls: true,
  srcExclude: [
    'docs/**',
    'CLAUDE.md',
    '.claude/**',
    'scripts/**',
    'node_modules/**',
    'tmp-mermaid/**', // копии страниц из bun run mermaid:native
    ...unpublishedDirs(rks, '.').map((dir) => `${dir}/**`),
  ],
  rewrites: {
    'README.md': 'index.md',
    ...Object.fromEntries(rks.map((rk) => [`${rk.dir}/README.md`, `${rk.dir}/index.md`])),
  },
  markdown: {
    anchor: { slugify: githubSlug },
    config(md) {
      md.use(readmeLinks);
    },
  },
  themeConfig: {
    nav: navItems(rks),
    sidebar: sidebars(rks, '.'),
    outline: { level: [2, 3], label: 'На этой странице' },
    docFooter: { prev: 'Предыдущая страница', next: 'Следующая страница' },
    sidebarMenuLabel: 'Меню',
    returnToTopLabel: 'Наверх',
    darkModeSwitchLabel: 'Оформление',
    lightModeSwitchTitle: 'Светлая тема',
    darkModeSwitchTitle: 'Тёмная тема',
    langMenuLabel: 'Язык',
    notFound: {
      title: 'Страница не найдена',
      quote: 'Такой страницы нет — возможно, её переименовали.',
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
});
