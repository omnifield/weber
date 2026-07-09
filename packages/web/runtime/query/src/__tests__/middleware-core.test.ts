import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { NetworkError, ValidationError } from '../errors';
import {
  buildRequest,
  httpTransport,
  mapDomain,
  validateInput,
  validateResponse,
} from '../middleware/core';
import type { ApiContext } from '../pipeline';
import type { HttpMethod } from '../types';

// Core mw — основа pipeline'а: zod-валидация, path-params/body/qs
// сборка, делегирование на QueryClient, response-валидация, dto→domain.
// Тесты держат контракт каждой стадии в изоляции.

const mkCtx = (overrides: Partial<ApiContext> & { config?: any } = {}): ApiContext => ({
  endpointName: 'test',
  config: { method: 'GET', path: '/' } as any,
  client: {} as any,
  input: undefined,
  request: { method: 'GET' },
  meta: {},
  ...overrides,
});

const noop = async () => {};

describe('validateInput', () => {
  it('no-op when schema absent', async () => {
    const ctx = mkCtx({ input: { foo: 'raw' } });
    await validateInput()(ctx, noop);
    expect(ctx.input).toEqual({ foo: 'raw' });
  });

  it('throws ValidationError("request") on parse failure', async () => {
    const ctx = mkCtx({
      input: { id: 123 },
      config: { method: 'GET', path: '/', request: z.object({ id: z.string() }) } as any,
    });
    await expect(validateInput()(ctx, noop)).rejects.toBeInstanceOf(ValidationError);
    await expect(
      validateInput()(
        mkCtx({
          input: { id: 123 },
          config: { method: 'GET', path: '/', request: z.object({ id: z.string() }) } as any,
        }),
        noop,
      ),
    ).rejects.toMatchObject({ phase: 'request' });
  });

  it('writes parsed (typed) data back to ctx.input on success', async () => {
    const ctx = mkCtx({
      input: { id: 'abc', extra: 'dropped' },
      config: {
        method: 'GET',
        path: '/',
        request: z.object({ id: z.string() }).strip(),
      } as any,
    });
    await validateInput()(ctx, noop);
    expect(ctx.input).toEqual({ id: 'abc' }); // 'extra' stripped по zod-схеме
  });
});

describe('buildRequest — path params', () => {
  it('substitutes :param from input', async () => {
    const ctx = mkCtx({
      input: { id: 'u-1' },
      config: { method: 'GET', path: '/users/:id' } as any,
    });
    await buildRequest()(ctx, noop);
    expect(ctx.request.url).toBe('/users/u-1');
  });

  it('throws if :param is missing from input', async () => {
    const ctx = mkCtx({
      input: {},
      config: { method: 'GET', path: '/users/:id' } as any,
    });
    await expect(buildRequest()(ctx, noop)).rejects.toThrow(/Missing path param ":id"/);
  });

  it('URL-encodes path values', async () => {
    const ctx = mkCtx({
      input: { id: 'a b/c' },
      config: { method: 'GET', path: '/users/:id' } as any,
    });
    await buildRequest()(ctx, noop);
    expect(ctx.request.url).toBe('/users/a%20b%2Fc');
  });
});

describe('buildRequest — body vs params', () => {
  it.each([
    'GET',
    'HEAD',
    'DELETE',
  ] as const satisfies HttpMethod[])('%s — non-path input → params (no body)', async (method) => {
    const ctx = mkCtx({
      input: { id: 'x', page: 1, active: true },
      config: { method, path: '/users/:id' } as any,
    });
    await buildRequest()(ctx, noop);
    expect(ctx.request.body).toBeUndefined();
    expect(ctx.request.params).toEqual({ page: 1, active: true });
  });

  it.each([
    'POST',
    'PUT',
    'PATCH',
  ] as const satisfies HttpMethod[])('%s — non-path input → body (no params)', async (method) => {
    const ctx = mkCtx({
      input: { id: 'x', email: 'a@b.c' },
      config: { method, path: '/users/:id' } as any,
    });
    await buildRequest()(ctx, noop);
    expect(ctx.request.body).toEqual({ email: 'a@b.c' });
    expect(ctx.request.params).toBeUndefined();
  });

  it('GET с null/undefined значениями → ключи пропускаются', async () => {
    const ctx = mkCtx({
      input: { id: 'x', filter: null, page: undefined, active: false },
      config: { method: 'GET', path: '/users/:id' } as any,
    });
    await buildRequest()(ctx, noop);
    expect(ctx.request.params).toEqual({ active: false });
  });

  it('empty rest → no body / no params', async () => {
    const ctx = mkCtx({
      input: { id: 'x' },
      config: { method: 'GET', path: '/users/:id' } as any,
    });
    await buildRequest()(ctx, noop);
    expect(ctx.request.body).toBeUndefined();
    expect(ctx.request.params).toBeUndefined();
  });

  it('preserves config.base', async () => {
    const ctx = mkCtx({
      input: { id: '1' },
      config: { method: 'GET', path: '/u/:id', base: 'cdn' } as any,
    });
    await buildRequest()(ctx, noop);
    expect(ctx.request.base).toBe('cdn');
  });
});

describe('httpTransport', () => {
  it('GET → client.fetch with [endpointName, input] key + staleTime', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: 1 });
    const client = { fetch, mutate: vi.fn() } as any;
    const ctx = mkCtx({
      client,
      input: { id: 'u-1' },
      request: { method: 'GET', url: '/users/u-1' },
      config: { method: 'GET', path: '/users/:id', staleTime: 5000 } as any,
    });
    await httpTransport()(ctx, noop);
    expect(client.mutate).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      ['__endpoint', 'test', { id: 'u-1' }],
      expect.objectContaining({ method: 'GET', url: '/users/u-1', staleTime: 5000 }),
    );
    expect(ctx.response).toEqual({ ok: 1 });
  });

  it('non-GET → client.mutate with name', async () => {
    const mutate = vi.fn().mockResolvedValue({ created: true });
    const client = { fetch: vi.fn(), mutate } as any;
    const ctx = mkCtx({
      client,
      request: { method: 'POST', url: '/users', body: { email: 'a@b.c' } },
      config: { method: 'POST', path: '/users' } as any,
    });
    await httpTransport()(ctx, noop);
    expect(client.fetch).not.toHaveBeenCalled();
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', url: '/users', name: 'test' }),
    );
    expect(ctx.response).toEqual({ created: true });
  });

  it('error with .status → rethrows as-is (statusMapper will handle)', async () => {
    const httpErr = Object.assign(new Error('HTTP 404'), { status: 404 });
    const client = { fetch: vi.fn().mockRejectedValue(httpErr), mutate: vi.fn() } as any;
    const ctx = mkCtx({
      client,
      request: { method: 'GET', url: '/x' },
      config: { method: 'GET', path: '/x' } as any,
    });
    await expect(httpTransport()(ctx, noop)).rejects.toBe(httpErr);
  });

  it('error without .status → wraps into NetworkError', async () => {
    const rawErr = new Error('connection refused');
    const client = { fetch: vi.fn().mockRejectedValue(rawErr), mutate: vi.fn() } as any;
    const ctx = mkCtx({
      client,
      request: { method: 'GET', url: '/x' },
      config: { method: 'GET', path: '/x' } as any,
    });
    await expect(httpTransport()(ctx, noop)).rejects.toBeInstanceOf(NetworkError);
  });

  it('cache key uses null when input is undefined', async () => {
    const fetch = vi.fn().mockResolvedValue(null);
    const client = { fetch, mutate: vi.fn() } as any;
    const ctx = mkCtx({
      client,
      request: { method: 'GET', url: '/x' },
      config: { method: 'GET', path: '/x' } as any,
    });
    await httpTransport()(ctx, noop);
    expect(fetch).toHaveBeenCalledWith(['__endpoint', 'test', null], expect.any(Object));
  });
});

describe('validateResponse', () => {
  it('no-op when schema absent', async () => {
    const ctx = mkCtx({ response: { foo: 1, bar: 2 } });
    await validateResponse()(ctx, noop);
    expect(ctx.response).toEqual({ foo: 1, bar: 2 });
  });

  it('throws ValidationError("response") on parse failure', async () => {
    const ctx = mkCtx({
      response: { foo: 1 },
      config: { method: 'GET', path: '/', response: z.object({ foo: z.string() }) } as any,
    });
    await expect(validateResponse()(ctx, noop)).rejects.toMatchObject({
      phase: 'response',
    });
  });

  it('writes parsed data back to ctx.response on success', async () => {
    const ctx = mkCtx({
      response: { foo: 'ok', extra: 'dropped' },
      config: {
        method: 'GET',
        path: '/',
        response: z.object({ foo: z.string() }).strip(),
      } as any,
    });
    await validateResponse()(ctx, noop);
    expect(ctx.response).toEqual({ foo: 'ok' });
  });
});

describe('mapDomain', () => {
  it('without map: ctx.data === ctx.response', async () => {
    const ctx = mkCtx({ response: { id: 1 } });
    await mapDomain()(ctx, noop);
    expect(ctx.data).toEqual({ id: 1 });
  });

  it('with map: ctx.data = map(response)', async () => {
    const ctx = mkCtx({
      response: { id: 1, createdAt: '2020-01-01' },
      config: {
        method: 'GET',
        path: '/',
        map: (dto: any) => ({ ...dto, createdAt: new Date(dto.createdAt) }),
      } as any,
    });
    await mapDomain()(ctx, noop);
    expect((ctx.data as any).createdAt).toBeInstanceOf(Date);
  });
});
