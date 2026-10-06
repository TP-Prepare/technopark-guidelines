// Реестр РК — единственное место, где РК публикуется на сайте.
export interface Rk {
  dir: string; // 'rk1' — папка в корне репозитория
  title: string; // подпись группы бокового меню
  nav: string; // подпись в верхнем меню
  pages: string[]; // имена файлов без .md в порядке меню; первая — 'README'
}

export const rks: Rk[] = [
  {
    dir: 'rk1',
    title: 'РК1. Аутентификация, сессия и доступ к данным',
    nav: 'РК1',
    pages: ['README', 'basics', 'cors', 'variant-a', 'variant-b', 'variant-c',
            'csrf', 'access-control', 'pitfalls', 'checklist', 'questions'],
  },
];
