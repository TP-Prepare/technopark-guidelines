// Слаг заголовка по правилам GitHub: им пользуются проверка ссылок и сайт.
// Выделение снимается только парой, как в CommonMark: открывающий маркер не перед пробелом,
// закрывающий не после пробела, подчёркивания не внутри слова. Одиночные маркеры остаются.
const EMPHASIS_PAIRS: RegExp[] = [
  /\*\*(?=\S)(.+?)(?<=\S)\*\*/gu,
  /(?<![\p{L}\p{N}])__(?=\S)(.+?)(?<=\S)__(?![\p{L}\p{N}])/gu,
  /\*(?=\S)(.+?)(?<=\S)\*/gu,
  /(?<![\p{L}\p{N}])_(?=\S)(.+?)(?<=\S)_(?![\p{L}\p{N}])/gu,
];

export function stripEmphasis(text: string): string {
  return text
    .split(/(`[^`]*`)/)
    .map((part, index) => (index % 2 === 1 ? part : EMPHASIS_PAIRS.reduce((acc, re) => acc.replace(re, "$1"), part)))
    .join("");
}

export function githubSlug(heading: string): string {
  return stripEmphasis(heading.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").trim().toLowerCase())
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .replaceAll(" ", "-");
}
