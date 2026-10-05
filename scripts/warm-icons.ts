// Прогревает кэш иконок .eraser/icons перед рендером: докачивает по одной, с
// повторами, все иконки, которые используют схемы. Рендер грузит иконки
// параллельно с таймаутом 5 с и любую ошибку сети печатает как
// E_UNKNOWN_ICON (так упал Pages 2026-09-16). После прогрева кэш свежий и
// рендер в сеть не ходит. Настоящий 404 роняет сборку с именем иконки.
// Использование: bun scripts/warm-icons.ts
import { createEraserIconLoader } from "@eraserlabs/diagrams";
import type { DiagramDoc } from "./diagram.ts";
import { listDiagrams } from "./eraser.ts";

export const ICON_CACHE_DIR = ".eraser/icons";
const ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;
const FETCH_TIMEOUT_MS = 15_000;

export type IconLoader = (name: string) => Promise<string>;

export interface RetryOptions {
  attempts: number;
  delayMs: number;
  sleep: (ms: number) => Promise<void>;
}

// Имена иконок из всех схем: поле icon у Icon и title.icon у Group.
export function iconNames(docs: readonly DiagramDoc[]): string[] {
  const names = new Set<string>();
  for (const doc of docs) {
    for (const entity of doc.entities) {
      if (typeof entity.icon === "string") names.add(entity.icon);
      const title = entity.tag === "Group" ? entity.title : undefined;
      if (title?.icon) names.add(title.icon);
    }
  }
  return [...names].sort();
}

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

// Загрузчик пакета бросает `icon "<name>": HTTP 404`, когда иконки нет в каталоге.
const isNotFound = (error: unknown): boolean => /HTTP 404$/.test(errorMessage(error));

// Повторяет только сетевые сбои; отсутствующую иконку сообщает сразу.
export async function loadWithRetry(name: string, loader: IconLoader, options: RetryOptions): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      return await loader(name);
    } catch (error) {
      if (isNotFound(error)) throw new Error(`unknown icon "${name}": not in the Eraser catalog (icons.txt)`);
      lastError = error;
      if (attempt < options.attempts) await options.sleep(options.delayMs * attempt);
    }
  }
  throw new Error(`icon "${name}": ${options.attempts} attempts failed, last error: ${errorMessage(lastError)}`);
}

async function main(): Promise<number> {
  const docs = await Promise.all(listDiagrams().map((file) => Bun.file(file).json() as Promise<DiagramDoc>));
  const names = iconNames(docs);
  // Тот же загрузчик, что у рендера: свежий кэш отдаёт без сети, остальное качает и пишет в кэш.
  const loader = createEraserIconLoader({ cacheDir: ICON_CACHE_DIR, timeoutMs: FETCH_TIMEOUT_MS });
  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  for (const name of names) {
    try {
      await loadWithRetry(name, loader, { attempts: ATTEMPTS, delayMs: RETRY_DELAY_MS, sleep });
    } catch (error) {
      console.error(errorMessage(error));
      return 1;
    }
  }
  console.log(`icons warm: ${names.length} names in ${ICON_CACHE_DIR}`);
  return 0;
}

if (import.meta.main) {
  process.exit(await main());
}
