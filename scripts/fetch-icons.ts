// Обновляет icons.txt: имена иконок публичного каталога Eraser
// (https://storage.googleapis.com/eraser-public-assets/canvas-icons/<name>.svg).
// Использование: bun scripts/fetch-icons.ts

export const LIST_URL =
  "https://storage.googleapis.com/storage/v1/b/eraser-public-assets/o" +
  "?prefix=canvas-icons/&maxResults=1000&fields=items(name),nextPageToken";
const PREFIX = "canvas-icons/";
const SUFFIX = ".svg";

export interface GcsPage {
  items?: { name: string }[];
  nextPageToken?: string;
}

export type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export function namesFromPage(page: GcsPage): string[] {
  return (page.items ?? [])
    .map((item) => item.name)
    .filter((name) => name.startsWith(PREFIX) && name.endsWith(SUFFIX))
    .map((name) => name.slice(PREFIX.length, -SUFFIX.length));
}

export async function fetchAllIcons(fetchImpl: FetchLike = fetch): Promise<string[]> {
  const names = new Set<string>();
  let pageToken: string | undefined;
  do {
    const url = pageToken ? `${LIST_URL}&pageToken=${encodeURIComponent(pageToken)}` : LIST_URL;
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`GCS ${res.status} for ${url}`);
    const page = (await res.json()) as GcsPage;
    for (const name of namesFromPage(page)) names.add(name);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return [...names].sort();
}

export function formatIconsFile(names: readonly string[]): string {
  return names.join("\n") + "\n";
}

if (import.meta.main) {
  const names = await fetchAllIcons();
  await Bun.write("icons.txt", formatIconsFile(names));
  console.error(`icons.txt: ${names.length} names`);
}
