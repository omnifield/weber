import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { setQueryClient } from '../client';
import { createApi, setApiClient } from '../createApi';
import { defineEndpoint, type PreRequestCtx } from '../endpoint';

// preRequest — typed-сахар над middleware pipeline. Тесты держат:
//  - совместимость без хэндлера (regression);
//  - short-circuit через resolve/reject (без походов в сеть);
//  - setInput → downstream видит новое значение;
//  - guard против двойного резолва;
//  - async-семантика (await fn);
//  - тип-уровневые контракты (resolve(D), не любой объект).

const mockFetch = (body: unknown, status = 200) =>
  vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  ) as unknown as typeof fetch;

afterEach(() => {
  setQueryClient(undefined as any);
  setApiClient(undefined);
  vi.unstubAllGlobals();
});

describe('preRequest — regression (хэндлера нет)', () => {
  it('pipeline ведёт себя как раньше — fetch вызывается, output возвращается', async () => {
    const fetchSpy = mockFetch({ id: '1', email: 'a@b.c' });
    vi.stubGlobal('fetch', fetchSpy);
    const get = defineEndpoint(({ zod }) => ({
      method: 'GET',
      path: '/users/:id',
      request: zod.object({ id: zod.string() }),
      response: zod.object({ id: zod.string(), email: zod.string() }),
    }));
    const api = createApi({ bases: { default: '/api' } }, { get });
    const out = await (api as any).get({ id: '1' });
    expect(out).toEqual({ id: '1', email: 'a@b.c' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe('preRequest — short-circuit', () => {
  it('resolve(data) пишет ctx.data и НЕ дёргает сеть', async () => {
    const fetchSpy = mockFetch({ unreachable: true });
    vi.stubGlobal('fetch', fetchSpy);
    const get = defineEndpoint(({ zod }) => ({
      method: 'GET',
      path: '/x',
      response: zod.any(),
      preRequest: ({ resolve }) => resolve({ id: 'mocked' }),
    }));
    const api = createApi({}, { get });
    const out = await (api as any).get(undefined);
    expect(out).toEqual({ id: 'mocked' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reject(err) бросает err из endpoint-вызова', async () => {
    const fetchSpy = mockFetch({});
    vi.stubGlobal('fetch', fetchSpy);
    const customErr = new Error('business rule violated');
    const post = defineEndpoint(({ zod }) => ({
      method: 'POST',
      path: '/charge',
      response: zod.any(),
      preRequest: ({ reject }) => reject(customErr),
    }));
    const api = createApi({}, { post });
    await expect((api as any).post(undefined)).rejects.toBe(customErr);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('resolve(data) пропускает validateResponse + mapDomain (caller передаёт final shape)', async () => {
    const fetchSpy = mockFetch({});
    vi.stubGlobal('fetch', fetchSpy);
    // response-схема была бы строгой (требует zod.number) — но mock-данные строкой проходят:
    // validateResponse пропущен, mapDomain пропущен.
    const get = defineEndpoint(({ zod }) => ({
      method: 'GET',
      path: '/x',
      response: zod.object({ count: zod.number() }),
      map: (dto) => ({ count: dto.count + 1 }),
      preRequest: ({ resolve }) => resolve({ count: 'NOT_A_NUMBER' as any }),
    }));
    const api = createApi({}, { get });
    const out: any = await (api as any).get(undefined);
    // map не отработал (+1 не применился), validate не упал.
    expect(out).toEqual({ count: 'NOT_A_NUMBER' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('preRequest — guards', () => {
  it('двойной resolve → throws "called more than once"', async () => {
    const get = defineEndpoint(({ zod }) => ({
      method: 'GET',
      path: '/x',
      response: zod.any(),
      preRequest: ({ resolve }) => {
        resolve({ a: 1 });
        resolve({ a: 2 });
      },
    }));
    const api = createApi({}, { get });
    await expect((api as any).get(undefined)).rejects.toThrow(/called more than once/);
  });

  it('resolve() затем reject() → throws "called more than once"', async () => {
    const get = defineEndpoint(({ zod }) => ({
      method: 'GET',
      path: '/x',
      response: zod.any(),
      preRequest: ({ resolve, reject }) => {
        resolve({ a: 1 });
        reject(new Error('после resolve'));
      },
    }));
    const api = createApi({}, { get });
    await expect((api as any).get(undefined)).rejects.toThrow(/called more than once/);
  });
});

describe('preRequest — setInput', () => {
  it('downstream middleware видит мутированный input', async () => {
    const fetchSpy = mockFetch({ ok: 1 });
    vi.stubGlobal('fetch', fetchSpy);

    let seenInput: unknown;
    const get = defineEndpoint(({ zod }) => ({
      method: 'GET',
      path: '/x',
      request: zod.object({ q: zod.string() }),
      response: zod.any(),
      preRequest: ({ input, setInput }) => {
        // input здесь уже zod-parsed (типа { q: string }), кладём расширенный
        // объект (`as any` потому что новый input шире — setInput не валидируется).
        setInput({ ...input, q: input.q.trim().toLowerCase() } as any);
      },
      middleware: [
        async (ctx, next) => {
          // Этот mw запускается ПОСЛЕ всего pipeline'а — input уже трансформирован.
          seenInput = ctx.input;
          await next();
        },
      ],
    }));
    const api = createApi({}, { get });
    await (api as any).get({ q: '  HELLO  ' });
    expect(seenInput).toEqual({ q: 'hello' });
  });

  it('setInput НЕ перевалидирует через endpoint.request (caller-responsibility)', async () => {
    const fetchSpy = mockFetch({});
    vi.stubGlobal('fetch', fetchSpy);

    const get = defineEndpoint(({ zod }) => ({
      method: 'GET',
      path: '/x',
      request: zod.object({ id: zod.string() }),
      response: zod.any(),
      preRequest: ({ setInput }) => {
        // Невалидное по схеме значение — но НЕ throw'ает.
        setInput({ id: 12345 as unknown as string });
      },
    }));
    const api = createApi({}, { get });
    // Не должно бросать ValidationError.
    await expect((api as any).get({ id: 'x' })).resolves.toBeDefined();
  });
});

describe('preRequest — async', () => {
  it('awaits корректно (Promise-based handler)', async () => {
    const get = defineEndpoint(({ zod }) => ({
      method: 'GET',
      path: '/x',
      response: zod.any(),
      preRequest: async ({ resolve }) => {
        await new Promise<void>((r) => setTimeout(r, 10));
        resolve({ delayed: true });
      },
    }));
    const api = createApi({}, { get });
    const out = await (api as any).get(undefined);
    expect(out).toEqual({ delayed: true });
  });
});

describe('preRequest — ctx.endpoint', () => {
  it('содержит path + method readable', async () => {
    let seenEndpoint: PreRequestCtx<unknown, unknown>['endpoint'] | undefined;
    const post = defineEndpoint(({ zod }) => ({
      method: 'POST',
      path: '/charge/:id',
      response: zod.any(),
      preRequest: ({ endpoint, resolve }) => {
        seenEndpoint = endpoint;
        resolve({});
      },
    }));
    const api = createApi({}, { post });
    await (api as any).post({ id: '1' });
    expect(seenEndpoint).toEqual({ path: '/charge/:id', method: 'POST' });
  });
});

describe('preRequest — изоляция (не аффектит endpoints без хэндлера)', () => {
  it('validateInput всё ещё запускается на endpoint без preRequest', async () => {
    const fetchSpy = mockFetch({});
    vi.stubGlobal('fetch', fetchSpy);
    const get = defineEndpoint(({ zod }) => ({
      method: 'GET',
      path: '/x',
      request: zod.object({ id: zod.string() }),
      response: zod.any(),
    }));
    const api = createApi({}, { get });
    // Невалидный input должен упасть в validateInput (preRequest здесь нет).
    await expect((api as any).get({ id: 123 })).rejects.toMatchObject({
      phase: 'request',
    });
  });
});

describe('preRequest — type-level', () => {
  it('PreRequestCtx<I, D>: resolve(D) типизирован, чужие shape отвергаются', () => {
    type Ctx = PreRequestCtx<{ email: string }, { token: string }>;
    type ResolveArg = Parameters<Ctx['resolve']>[0];
    expectTypeOf<ResolveArg>().toEqualTypeOf<{ token: string }>();
    type InputArg = Ctx['input'];
    expectTypeOf<InputArg>().toEqualTypeOf<{ email: string }>();
  });
});
