// Реестр РК — единственное место, где РК публикуется на сайте.
// Страница меню: имя файла (подпись из заголовка `# `) или имя с короткой подписью.
export type PageRef = string | { page: string; text: string };
// Группа меню: один уровень. link — относительно папки РК, например 'README#якорь'.
export interface PageGroup {
  text: string;
  link?: string;
  items: PageRef[];
}

export interface Rk {
  dir: string; // 'rk1' — папка в корне репозитория
  title: string; // подпись группы бокового меню
  nav: string; // подпись в верхнем меню
  pages: (PageRef | PageGroup)[]; // порядок меню; первая страница — 'README'
}

export const rks: Rk[] = [
  {
    dir: 'rk1',
    title: 'РК1. Аутентификация, сессия и доступ к данным',
    nav: 'РК1',
    pages: [
      { page: 'README', text: 'Обзор' },
      'basics',
      'cors',
      {
        text: 'Варианты сессии',
        link: 'README#варианты-сессии',
        items: [
          { page: 'variant-a', text: 'Вариант A: cookie + CSRF' },
          { page: 'variant-b', text: 'Вариант B: Bearer в памяти + refresh-cookie' },
          { page: 'variant-c', text: 'Вариант C: сессия в Redis/БД + CSRF' },
        ],
      },
      'csrf',
      'access-control',
      'pitfalls',
      'checklist',
      'questions',
    ],
  },
  {
    dir: 'tools',
    title: 'Инструменты',
    nav: 'Инструменты',
    pages: [{ page: 'README', text: 'Обзор' }, 'cookie-viewer'],
  },
];
