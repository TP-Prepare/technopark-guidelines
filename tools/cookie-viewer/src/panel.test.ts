/** Панель на поддельных DOM и chrome.*: удаление, автообновление и выбор поддомена. */
import { beforeEach, expect, test } from 'bun:test';

class FakeElement {
  children: (FakeElement | string)[] = [];
  listeners: Record<string, (() => void)[]> = {};
  textContent = '';
  className = '';
  disabled = false;
  value = '';
  checked = false;
  type = '';
  title = '';
  selected = false;
  constructor(readonly tag: string) {}
  addEventListener(type: string, listener: () => void): void {
    (this.listeners[type] ??= []).push(listener);
  }
  replaceChildren(...nodes: (FakeElement | string)[]): void {
    this.children = nodes;
  }
  append(...nodes: (FakeElement | string)[]): void {
    this.children.push(...nodes);
  }
  setAttribute(): void {}
  fire(type: string): void {
    for (const listener of this.listeners[type] ?? []) listener();
  }
  text(): string {
    return [this.textContent, ...this.children.map((c) => (typeof c === 'string' ? c : c.text()))].join(' ');
  }
  findAll(match: (el: FakeElement) => boolean): FakeElement[] {
    const found: FakeElement[] = [];
    const walk = (node: FakeElement | string): void => {
      if (typeof node === 'string') return;
      if (match(node)) found.push(node);
      node.children.forEach(walk);
    };
    walk(this);
    return found;
  }
}

interface FakeCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: string;
}

const cookie = (domain: string, path: string, name: string): FakeCookie => ({
  name,
  value: 'v',
  domain,
  path,
  httpOnly: false,
  secure: false,
  sameSite: 'lax',
});

/** Ушла бы cookie на адрес — как в Chrome: хост, путь, схема для Secure. */
function sentTo(c: FakeCookie, url: URL): boolean {
  const host = url.hostname;
  const domain = c.domain.replace(/^\./, '');
  const hostOk = c.domain.startsWith('.') ? host === domain || host.endsWith(`.${domain}`) : host === domain;
  const pathOk = url.pathname === c.path || url.pathname.startsWith(c.path.endsWith('/') ? c.path : `${c.path}/`);
  return hostOk && pathOk && (!c.secure || url.protocol === 'https:');
}

let jar: FakeCookie[] = [];
const ids: Record<string, FakeElement> = {};
for (const id of ['domain', 'refresh', 'remove-all', 'show-values', 'content']) ids[id] = new FakeElement(id);
const requestFinished: (() => void)[] = [];
const cookieChanged: ((info: { cookie: FakeCookie }) => void)[] = [];
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const noop = { addListener(): void {} };

Object.assign(globalThis, {
  document: { getElementById: (id: string) => ids[id], createElement: (tag: string) => new FakeElement(tag) },
  chrome: {
    devtools: {
      inspectedWindow: { eval: (_: string, cb: (href: string) => void) => cb('http://app.example.ru/') },
      network: { onNavigated: noop, onRequestFinished: { addListener: (f: () => void) => requestFinished.push(f) } },
    },
    permissions: { contains: async () => true, request: async () => true, onAdded: noop, onRemoved: noop },
    cookies: {
      onChanged: { addListener: (f: (info: { cookie: FakeCookie }) => void) => cookieChanged.push(f) },
      async getAll(filter: { domain?: string; url?: string; name?: string }) {
        const snapshot = jar
          .filter((c) => filter.name === undefined || c.name === filter.name)
          .filter((c) => {
            if (filter.url !== undefined) return sentTo(c, new URL(filter.url));
            const domain = c.domain.replace(/^\./, '');
            return domain === filter.domain || domain.endsWith(`.${filter.domain}`);
          })
          .map((c) => ({ ...c }));
        await sleep(5);
        return snapshot;
      },
      async remove(details: { url: string; name: string }) {
        await sleep(5);
        const url = new URL(details.url);
        const removed = jar.filter((c) => c.name === details.name && sentTo(c, url));
        jar = jar.filter((c) => !removed.includes(c));
        for (const c of removed) cookieChanged.forEach((f) => f({ cookie: c }));
        return details;
      },
    },
  },
});

await import('./panel.ts');

const content = ids['content'] as FakeElement;
const shownRows = (): string[] =>
  content
    .findAll((el) => el.tag === 'tr')
    .slice(1)
    .map((tr) => tr.text().replace(/\s+/g, ' ').trim());
const notice = (): string => content.findAll((el) => el.className === 'message notice').map((el) => el.text().trim()).join('|');
const clickRemove = (path: string, name: string): void => {
  const row = content
    .findAll((el) => el.tag === 'tr')
    .slice(1)
    .find((tr) => tr.children[0] instanceof FakeElement && tr.children[0].textContent === name && tr.text().includes(` ${path} `));
  row?.findAll((el) => el.className === 'remove')[0]?.fire('click');
};
const selectDomain = (domain: string): void => {
  (ids['domain'] as FakeElement).value = domain;
  (ids['domain'] as FakeElement).fire('change');
};

beforeEach(async () => {
  await sleep(400);
  jar = [];
  (ids['refresh'] as FakeElement).fire('click');
  await sleep(50);
});

test('взведённый таймер автообновления не выбрасывает результат удаления', async () => {
  selectDomain('example.ru');
  jar = [cookie('example.ru', '/', 'a'), cookie('example.ru', '/api', 'a'), cookie('example.ru', '/', 'b')];
  (ids['refresh'] as FakeElement).fire('click');
  await sleep(50);
  requestFinished.forEach((f) => f());
  await sleep(290);
  clickRemove('/api', 'a');
  await sleep(800);
  expect(jar.map((c) => c.name + c.path)).toEqual(['b/']);
  expect(shownRows().length).toBe(1);
  expect(notice()).toContain('Chrome удалил вместе с ней: a (example.ru, Path=/)');
});

test('новое удаление стирает сообщение прошлого, даже при взведённом таймере', async () => {
  selectDomain('example.ru');
  jar = [cookie('example.ru', '/', 'a'), cookie('example.ru', '/api', 'a'), cookie('example.ru', '/', 'b')];
  (ids['refresh'] as FakeElement).fire('click');
  await sleep(50);
  clickRemove('/api', 'a');
  await sleep(400);
  expect(notice()).toContain('Chrome удалил вместе с ней');
  requestFinished.forEach((f) => f());
  await sleep(290);
  clickRemove('/', 'b');
  await sleep(800);
  expect(jar).toEqual([]);
  expect(notice()).toBe('');
  expect(shownRows()).toEqual([]);
});

test('выбран поддомен: крестик называет удалённую заодно cookie родительского домена', async () => {
  selectDomain('app.example.ru');
  jar = [cookie('.example.ru', '/', 'a'), cookie('app.example.ru', '/', 'a')];
  (ids['refresh'] as FakeElement).fire('click');
  await sleep(50);
  expect(shownRows().length).toBe(1);
  clickRemove('/', 'a');
  await sleep(400);
  expect(jar).toEqual([]);
  expect(notice()).toContain('Chrome удалил вместе с ней: a (.example.ru, Path=/)');
});

test('выбран поддомен: «Удалить все» называет удалённые cookie вне выбранного домена', async () => {
  selectDomain('app.example.ru');
  jar = [cookie('.example.ru', '/', 'a'), cookie('app.example.ru', '/', 'a'), cookie('app.example.ru', '/', 'c')];
  (ids['refresh'] as FakeElement).fire('click');
  await sleep(50);
  (ids['remove-all'] as FakeElement).fire('click');
  await sleep(400);
  expect(jar).toEqual([]);
  expect(notice()).toBe(
    'Chrome удалил также cookie вне выбранного домена: a (.example.ru, Path=/). API удаляет все cookie с этим именем, которые ушли бы на адрес удаляемой.',
  );
});
