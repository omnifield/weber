import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient, getQueryClient, QueryClient, setQueryClient } from '../client';
import type { Fetcher } from '../types';

// QueryClient — главное звено: resolveUrl + interceptors + cache + dedupe +
// mutate + invalidate. Тесты максимально через публичный fetch/mutate
// чтобы не подсаживаться на приватные поля.

const mkFetcher = (impl?: (req: any) => any) =>
  vi.fn(impl ?? (async () => ({ ok: true }))) as unknown as Fetcher;

describe('createQueryClient', () => {
  it('returns a QueryClient instance', () => {
    expect(createQueryClient()).toBeInstanceOf(QueryClient);
  });
});

describe('resolveUrl behaviour (через fetch)', () => {
  it('joins bases.default + url', async () => {
    const fetcher = mkFetcher();
    const c = new QueryClient({ bases: { default: '/api' }, fetcher });
    await c.fetch(['k'], { method: 'GET', url: '/users' });
    expect((fetcher as any).mock.calls[0][0].resolvedUrl).toBe('/api/users');
  });

  it('selects base by name when request.base set', async () => {
    const fetcher = mkFetcher();
    const c = new QueryClient({
      bases: { default: '/api', cdn: 'https://cdn.example.com' },
      fetcher,
    });
    await c.fetch(['k'], { method: 'GET', url: '/a.png', base: 'cdn' });
    expect((fetcher as any).mock.calls[0][0].resolvedUrl).toBe('https://cdn.example.com/a.png');
  });

  it('absolute http URL bypasses bases', async () => {
    const fetcher = mkFetcher();
    const c = new QueryClient({ bases: { default: '/api' }, fetcher });
    await c.fetch(['k'], { method: 'GET', url: 'https://x.example.com/y' });
    expect((fetcher as any).mock.calls[0][0].resolvedUrl).toBe('https://x.example.com/y');
  });

  it('appends params as querystring', async () => {
    const fetcher = mkFetcher();
    const c = new QueryClient({ bases: { default: '/api' }, fetcher });
    await c.fetch(['k'], {
      method: 'GET',
      url: '/users',
      params: { page: 1, q: 'foo bar' },
    });
    const url = (fetcher as any).mock.calls[0][0].resolvedUrl;
    expect(url).toContain('/api/users?');
    expect(url).toContain('page=1');
    expect(url).toContain('q=foo+bar');
  });

  it('appends params with & when URL already has ?', async () => {
    const fetcher = mkFetcher();
    const c = new QueryClient({ fetcher });
    await c.fetch(['k'], { method: 'GET', url: '/x?a=1', params: { b: 2 } });
    expect((fetcher as any).mock.calls[0][0].resolvedUrl).toBe('/x?a=1&b=2');
  });

  it('params: undefined / null значения пропускаются (skip-if-not-set)', async () => {
    const fetcher = mkFetcher();
    const c = new QueryClient({ fetcher });
    await c.fetch(['k'], {
      method: 'GET',
      url: '/x',
      params: { a: 1, b: undefined, c: null, d: 2 },
    });
    const url = (fetcher as any).mock.calls[0][0].resolvedUrl;
    expect(url).toBe('/x?a=1&d=2');
  });

  it('params: пустой набор после skip — не клеит "?"', async () => {
    const fetcher = mkFetcher();
    const c = new QueryClient({ fetcher });
    await c.fetch(['k'], {
      method: 'GET',
      url: '/x',
      params: { a: undefined, b: null },
    });
    expect((fetcher as any).mock.calls[0][0].resolvedUrl).toBe('/x');
  });

  it('params: массив → multi-value query (?tags=a&tags=b)', async () => {
    const fetcher = mkFetcher();
    const c = new QueryClient({ fetcher });
    await c.fetch(['k'], { method: 'GET', url: '/x', params: { tags: ['a', 'b', 'c'] } });
    const url = (fetcher as any).mock.calls[0][0].resolvedUrl;
    expect(url).toBe('/x?tags=a&tags=b&tags=c');
  });

  it('params: массив с undefined/null элементами — пропускает их', async () => {
    const fetcher = mkFetcher();
    const c = new QueryClient({ fetcher });
    await c.fetch(['k'], {
      method: 'GET',
      url: '/x',
      params: { tags: ['a', undefined, 'b', null] },
    });
    expect((fetcher as any).mock.calls[0][0].resolvedUrl).toBe('/x?tags=a&tags=b');
  });

  it('params: смешанные типы (string / number / boolean / array)', async () => {
    const fetcher = mkFetcher();
    const c = new QueryClient({ fetcher });
    await c.fetch(['k'], {
      method: 'GET',
      url: '/x',
      params: { q: 'foo', n: 42, active: true, t: ['a', 'b'] },
    });
    const url = (fetcher as any).mock.calls[0][0].resolvedUrl;
    expect(url).toContain('q=foo');
    expect(url).toContain('n=42');
    expect(url).toContain('active=true');
    expect(url).toContain('t=a&t=b');
  });

  it('unknown base name → empty prefix (no crash)', async () => {
    const fetcher = mkFetcher();
    const c = new QueryClient({ fetcher });
    await c.fetch(['k'], { method: 'GET', url: '/x', base: 'nope' });
    expect((fetcher as any).mock.calls[0][0].resolvedUrl).toBe('/x');
  });
});

describe('defaultHeaders + interceptors', () => {
  it('merges defaultHeaders, request.headers wins on conflict', async () => {
    const fetcher = mkFetcher();
    const c = new QueryClient({
      defaultHeaders: { Accept: 'application/json', 'X-Trace': 'T1' },
      fetcher,
    });
    await c.fetch(['k'], { method: 'GET', url: '/x', headers: { 'X-Trace': 'T2' } });
    expect((fetcher as any).mock.calls[0][0].headers).toEqual({
      Accept: 'application/json',
      'X-Trace': 'T2',
    });
  });

  it('request interceptors run in order, can mutate', async () => {
    const fetcher = mkFetcher();
    const c = new QueryClient({
      interceptors: {
        request: [
          (req) => ({ ...req, headers: { ...(req.headers ?? {}), A: '1' } }),
          (req) => ({ ...req, headers: { ...(req.headers ?? {}), B: '2' } }),
        ],
      },
      fetcher,
    });
    await c.fetch(['k'], { method: 'GET', url: '/x' });
    expect((fetcher as any).mock.calls[0][0].headers).toMatchObject({ A: '1', B: '2' });
  });

  it('response interceptors run in order on success', async () => {
    const fetcher = mkFetcher(async () => 'raw');
    const c = new QueryClient({
      interceptors: {
        response: [(res) => `${res as string}-1`, (res) => `${res as string}-2`],
      },
      fetcher,
    });
    const out = await c.fetch(['k'], { method: 'GET', url: '/x' });
    expect(out).toBe('raw-1-2');
  });

  it('error interceptors run on failure, may transform error', async () => {
    const fetcher = mkFetcher(async () => {
      throw new Error('boom');
    });
    const c = new QueryClient({
      interceptors: { error: [() => new Error('renamed')] },
      fetcher,
    });
    await expect(c.fetch(['k'], { method: 'GET', url: '/x' })).rejects.toThrow('renamed');
  });
});

describe('fetch — cache behavior', () => {
  it('cache hit within staleTime returns cached data without refetch', async () => {
    const fetcher = mkFetcher(async () => ({ v: Math.random() }));
    const c = new QueryClient({ defaultStaleTime: 60_000, fetcher });
    const a = await c.fetch(['k'], { method: 'GET', url: '/x' });
    const b = await c.fetch(['k'], { method: 'GET', url: '/x' });
    expect(a).toBe(b);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('staleTime=0 refetches every call', async () => {
    const fetcher = mkFetcher(async () => ({ v: Math.random() }));
    const c = new QueryClient({ defaultStaleTime: 0, fetcher });
    await c.fetch(['k'], { method: 'GET', url: '/x' });
    await c.fetch(['k'], { method: 'GET', url: '/x' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('parallel fetches dedupe to single in-flight promise', async () => {
    let resolve!: (v: unknown) => void;
    const promise = new Promise((r) => {
      resolve = r;
    });
    const fetcher = vi.fn(async () => promise) as unknown as Fetcher;
    const c = new QueryClient({ fetcher });

    const p1 = c.fetch(['k'], { method: 'GET', url: '/x' });
    const p2 = c.fetch(['k'], { method: 'GET', url: '/x' });
    resolve({ v: 1 });
    const [a, b] = await Promise.all([p1, p2]);
    expect(a).toEqual({ v: 1 });
    expect(b).toEqual({ v: 1 });
    expect(fetcher).toHaveBeenCalledOnce();
  });
});

describe('fetch — syncTo (IBridge)', () => {
  const mkBridge = () => ({
    setLoading: vi.fn(),
    setErrors: vi.fn(),
  });

  it('marks loading true→false on success', async () => {
    const bridge = mkBridge();
    const fetcher = mkFetcher();
    const c = new QueryClient({ fetcher });
    await c.fetch(['k'], { method: 'GET', url: '/x', syncTo: bridge as any });
    expect(bridge.setLoading).toHaveBeenNthCalledWith(1, true);
    expect(bridge.setLoading).toHaveBeenNthCalledWith(2, false);
    expect(bridge.setErrors).not.toHaveBeenCalled();
  });

  it('sets error keyed by stringified queryKey on failure', async () => {
    const bridge = mkBridge();
    const fetcher = mkFetcher(async () => {
      throw new Error('nope');
    });
    const c = new QueryClient({ fetcher });
    await expect(
      c.fetch(['users', 1], { method: 'GET', url: '/x', syncTo: bridge as any }),
    ).rejects.toThrow();
    expect(bridge.setLoading).toHaveBeenLastCalledWith(false);
    expect(bridge.setErrors).toHaveBeenCalledWith({ '["users",1]': 'nope' });
  });
});

describe('mutate', () => {
  it('defaults to POST when method not set', async () => {
    const fetcher = mkFetcher();
    const c = new QueryClient({ fetcher });
    await c.mutate({ url: '/users' });
    expect((fetcher as any).mock.calls[0][0].method).toBe('POST');
  });

  it('invalidates given keys after success', async () => {
    const fetcher = mkFetcher(async () => ({ data: 'cached' }));
    const c = new QueryClient({ defaultStaleTime: 60_000, fetcher });
    await c.fetch(['users'], { method: 'GET', url: '/users' });
    expect(c.getQueryData(['users'])).toEqual({ data: 'cached' });

    await c.mutate({ url: '/users', invalidates: [['users']] });
    // Next fetch should hit network again because invalidate set fetchedAt=0
    await c.fetch(['users'], { method: 'GET', url: '/users' });
    expect(fetcher).toHaveBeenCalledTimes(3); // initial fetch + mutate + refetch
  });

  it('syncTo: loading true/false on success; errors not written', async () => {
    const bridge = { setLoading: vi.fn(), setErrors: vi.fn() };
    const fetcher = mkFetcher();
    const c = new QueryClient({ fetcher });
    await c.mutate({ url: '/x', syncTo: bridge as any });
    expect(bridge.setLoading).toHaveBeenCalledTimes(2);
    expect(bridge.setErrors).not.toHaveBeenCalled();
  });

  it('syncTo: errors written under name on failure', async () => {
    const bridge = { setLoading: vi.fn(), setErrors: vi.fn() };
    const fetcher = mkFetcher(async () => {
      throw new Error('bad');
    });
    const c = new QueryClient({ fetcher });
    await expect(
      c.mutate({ url: '/x', name: 'createUser', syncTo: bridge as any }),
    ).rejects.toThrow();
    expect(bridge.setErrors).toHaveBeenCalledWith({ createUser: 'bad' });
  });

  it('default error name = "mutation" when name omitted', async () => {
    const bridge = { setLoading: vi.fn(), setErrors: vi.fn() };
    const fetcher = mkFetcher(async () => {
      throw new Error('bad');
    });
    const c = new QueryClient({ fetcher });
    await expect(c.mutate({ url: '/x', syncTo: bridge as any })).rejects.toThrow();
    expect(bridge.setErrors).toHaveBeenCalledWith({ mutation: 'bad' });
  });
});

describe('prefetch — error swallowing', () => {
  it('does not throw on caller side, leaves cache untouched-on-error', async () => {
    const fetcher = mkFetcher(async () => {
      throw new Error('nope');
    });
    const c = new QueryClient({ fetcher });
    await expect(c.prefetch(['k'], { method: 'GET', url: '/x' })).resolves.toBeUndefined();
  });
});

describe('setQueryData / getQueryData / remove / clear / invalidate', () => {
  it('setQueryData writes; getQueryData reads', () => {
    const c = new QueryClient();
    c.setQueryData(['x'], { hi: 1 });
    expect(c.getQueryData(['x'])).toEqual({ hi: 1 });
  });

  it('remove deletes single entry', () => {
    const c = new QueryClient();
    c.setQueryData(['x'], 1);
    c.remove(['x']);
    expect(c.getQueryData(['x'])).toBeUndefined();
  });

  it('clear wipes everything', () => {
    const c = new QueryClient();
    c.setQueryData(['a'], 1);
    c.setQueryData(['b'], 2);
    c.clear();
    expect(c.getQueryData(['a'])).toBeUndefined();
    expect(c.getQueryData(['b'])).toBeUndefined();
  });

  it('invalidate marks matched-prefix as stale; next fetch refetches', async () => {
    const fetcher = mkFetcher(async () => ({ fresh: Date.now() }));
    const c = new QueryClient({ defaultStaleTime: 60_000, fetcher });
    await c.fetch(['users', 1], { method: 'GET', url: '/x' });
    c.invalidate(['users']);
    await c.fetch(['users', 1], { method: 'GET', url: '/x' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('module-level singleton: setQueryClient / getQueryClient', () => {
  beforeEach(() => {
    setQueryClient(undefined as any);
  });
  afterEach(() => {
    setQueryClient(undefined as any);
  });

  it('initially undefined', () => {
    expect(getQueryClient()).toBeUndefined();
  });

  it('roundtrips after set', () => {
    const c = new QueryClient();
    setQueryClient(c);
    expect(getQueryClient()).toBe(c);
  });
});
