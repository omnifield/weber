import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getQueryClient, QueryClient, setQueryClient } from '../client';
import {
  type ApiConfigInput,
  createApi,
  getApiClient,
  type MwToolbox,
  setApiClient,
} from '../createApi';
import { defineEndpoint } from '../endpoint';

// createApi склеивает endpoints в typed-proxy:
//  - сохраняет namespace-структуру (вложенность);
//  - резолвит ApiConfig (literal или factory({mw}));
//  - прокидывает global-middleware в каждую endpoint-pipeline.
//
// Сетевую часть мокаем через global fetch (fallback в defaultFetcher),
// чтобы не плодить QueryClient stub'ы.

const mockFetch = (body: unknown, status = 200) =>
  vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  ) as unknown as typeof fetch;

beforeEach(() => {
  setQueryClient(undefined as any);
  setApiClient(undefined);
});
afterEach(() => {
  setQueryClient(undefined as any);
  setApiClient(undefined);
});

describe('createApi — structure', () => {
  it('flat namespace: registry { ep } → api.ep is callable', () => {
    const ep = defineEndpoint(({ zod }) => ({
      method: 'GET',
      path: '/x',
      response: zod.any(),
    }));
    const api = createApi({}, { ep });
    expect(typeof (api as any).ep).toBe('function');
  });

  it('nested namespace: registry { user: { get } } → api.user.get callable', () => {
    const get = defineEndpoint(({ zod }) => ({
      method: 'GET',
      path: '/u/:id',
      request: zod.object({ id: zod.string() }),
      response: zod.object({ id: zod.string() }),
    }));
    const api = createApi({}, { user: { get } });
    expect(typeof (api as any).user.get).toBe('function');
  });

  it('deeply nested namespaces work', () => {
    const get = defineEndpoint(({ zod }) => ({
      method: 'GET',
      path: '/p',
      response: zod.any(),
    }));
    const api = createApi({}, { a: { b: { c: { get } } } });
    expect(typeof (api as any).a.b.c.get).toBe('function');
  });
});

describe('createApi — ApiConfigInput resolution', () => {
  it('accepts literal config', () => {
    const cfg: ApiConfigInput = { bases: { default: '/api' } };
    expect(() => createApi(cfg, {})).not.toThrow();
  });

  it('accepts factory and passes MwToolbox', () => {
    let captured: MwToolbox | undefined;
    createApi(({ mw }) => {
      captured = mw;
      return { bases: {} };
    }, {});
    expect(captured).toBeDefined();
    // Все 6 built-in mw факториев присутствуют.
    expect(typeof captured?.cookies).toBe('function');
    expect(typeof captured?.auth).toBe('function');
    expect(typeof captured?.statusMapper).toBe('function');
    expect(typeof captured?.on401).toBe('function');
    expect(typeof captured?.log).toBe('function');
    expect(typeof captured?.retry).toBe('function');
  });
});

describe('createApi — end-to-end call', () => {
  it('GET endpoint resolves URL via bases, runs through pipeline', async () => {
    const fetchSpy = mockFetch({ id: '1', email: 'a@b.c' });
    vi.stubGlobal('fetch', fetchSpy);
    try {
      const get = defineEndpoint(({ zod }) => ({
        method: 'GET',
        path: '/users/:id',
        request: zod.object({ id: zod.string() }),
        response: zod.object({ id: zod.string(), email: zod.string() }),
      }));
      const api = createApi({ bases: { default: '/api' } }, { user: { get } });
      const out = await (api as any).user.get({ id: '1' });
      expect(out).toEqual({ id: '1', email: 'a@b.c' });
      expect(fetchSpy).toHaveBeenCalledWith('/api/users/1', expect.any(Object));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('mapDomain runs after response-validation', async () => {
    vi.stubGlobal('fetch', mockFetch({ id: '1', createdAt: '2020-01-01' }));
    try {
      const get = defineEndpoint(({ zod }) => ({
        method: 'GET',
        path: '/u',
        response: zod.object({ id: zod.string(), createdAt: zod.string() }),
        map: (dto) => ({ id: dto.id, createdAt: new Date(dto.createdAt) }),
      }));
      const api = createApi({}, { get });
      const out: any = await (api as any).get(undefined);
      expect(out.createdAt).toBeInstanceOf(Date);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('global middleware (cookies) applies to every endpoint', async () => {
    const fetchSpy = mockFetch({});
    vi.stubGlobal('fetch', fetchSpy);
    try {
      const get = defineEndpoint(({ zod }) => ({
        method: 'GET',
        path: '/x',
        response: zod.any(),
      }));
      const api = createApi(
        ({ mw }) => ({
          middleware: [mw.cookies()],
        }),
        { get },
      );
      await (api as any).get(undefined);
      expect((fetchSpy as any).mock.calls[0][1].credentials).toBe('include');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('endpoint-level middleware runs AFTER global mw (and after mapDomain)', async () => {
    vi.stubGlobal('fetch', mockFetch({ v: 1 }));
    try {
      const trace: string[] = [];
      const get = defineEndpoint(({ zod }) => ({
        method: 'GET',
        path: '/x',
        response: zod.any(),
        middleware: [
          async (_ctx, next) => {
            trace.push('ep-pre');
            await next();
            trace.push('ep-post');
          },
        ],
      }));
      const api = createApi(
        () => ({
          middleware: [
            async (_ctx, next) => {
              trace.push('global-pre');
              await next();
              trace.push('global-post');
            },
          ],
        }),
        { get },
      );
      await (api as any).get(undefined);
      // global wraps endpoint
      expect(trace).toEqual(['global-pre', 'ep-pre', 'ep-post', 'global-post']);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('createApi — endpointName qualification', () => {
  it('nested path is dot-joined ("user.get")', async () => {
    const fetchSpy = mockFetch({});
    vi.stubGlobal('fetch', fetchSpy);
    try {
      let seenName = '';
      const get = defineEndpoint(({ zod }) => ({
        method: 'GET',
        path: '/x',
        response: zod.any(),
        middleware: [
          async (ctx, next) => {
            seenName = ctx.endpointName;
            await next();
          },
        ],
      }));
      const api = createApi({}, { user: { get } });
      await (api as any).user.get(undefined);
      expect(seenName).toBe('user.get');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('createApi — QueryClient publishing', () => {
  it('после createApi getQueryClient() возвращает использующийся клиент', () => {
    expect(getQueryClient()).toBeUndefined();
    createApi({ bases: { default: '/api' } }, {});
    const c = getQueryClient();
    expect(c).toBeInstanceOf(QueryClient);
  });

  it('client из getQueryClient — тот же, что в pipeline (можно invalidate из любого места)', async () => {
    const fetchSpy = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: '1' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    ) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchSpy);
    try {
      const get = defineEndpoint(({ zod }) => ({
        method: 'GET',
        path: '/u/:id',
        request: zod.object({ id: zod.string() }),
        response: zod.object({ id: zod.string() }),
      }));
      const api = createApi({ bases: { default: '/api' }, defaultStaleTime: 60_000 }, { get });
      await (api as any).get({ id: '1' });
      // Дёргаем cache через getQueryClient — это тот же client, что pipeline использовал.
      const c = getQueryClient()!;
      // Cache-key из httpTransport: ['__endpoint', 'get', { id: '1' }].
      expect(c.getQueryData(['__endpoint', 'get', { id: '1' }])).toEqual({ id: '1' });
      c.invalidate(['__endpoint', 'get']);
      await (api as any).get({ id: '1' });
      expect((fetchSpy as any).mock.calls.length).toBe(2); // invalidate сработал → refetch
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('setApiClient / getApiClient', () => {
  it('initially undefined', () => {
    expect(getApiClient()).toBeUndefined();
  });

  it('roundtrips arbitrary value', () => {
    const fake = { user: { get: () => {} } };
    setApiClient(fake);
    expect(getApiClient()).toBe(fake);
  });

  it('overwrites previous value', () => {
    setApiClient({ first: true });
    setApiClient({ second: true });
    expect(getApiClient()).toEqual({ second: true });
  });
});
