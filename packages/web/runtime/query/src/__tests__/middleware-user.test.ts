import { describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  ConflictError,
  ForbiddenError,
  HttpError,
  NetworkError,
  NotFoundError,
  ServerError,
  TimeoutError,
  UnauthorizedError,
} from '../errors';
import { auth, cookies, log, on401, retry, statusMapper } from '../middleware/user';
import type { ApiContext } from '../pipeline';

const mkCtx = (request: any = { method: 'GET' }): ApiContext => ({
  endpointName: 'test',
  config: { method: 'GET', path: '/' } as any,
  client: {} as any,
  input: undefined,
  request,
  meta: {},
});

describe('cookies', () => {
  it('sets request.credentials = include', async () => {
    const ctx = mkCtx();
    await cookies()(ctx, async () => {});
    expect(ctx.request.credentials).toBe('include');
  });
});

describe('auth', () => {
  it('adds Authorization: Bearer <token> by default', async () => {
    const ctx = mkCtx();
    await auth({ getToken: () => 'tok' })(ctx, async () => {});
    expect(ctx.request.headers).toEqual({ Authorization: 'Bearer tok' });
  });

  it('supports custom scheme + header', async () => {
    const ctx = mkCtx();
    await auth({ scheme: 'Basic', header: 'X-Auth', getToken: () => 'abc' })(ctx, async () => {});
    expect(ctx.request.headers).toEqual({ 'X-Auth': 'Basic abc' });
  });

  it('skips header if getToken returns null/undefined', async () => {
    const ctx = mkCtx();
    await auth({ getToken: () => null })(ctx, async () => {});
    expect(ctx.request.headers).toBeUndefined();
  });

  it('awaits async getToken', async () => {
    const ctx = mkCtx();
    await auth({ getToken: async () => 'async-tok' })(ctx, async () => {});
    expect(ctx.request.headers).toEqual({ Authorization: 'Bearer async-tok' });
  });

  it('preserves existing headers', async () => {
    const ctx = mkCtx({ method: 'GET', headers: { 'X-Trace': 't1' } });
    await auth({ getToken: () => 'tok' })(ctx, async () => {});
    expect(ctx.request.headers).toEqual({ 'X-Trace': 't1', Authorization: 'Bearer tok' });
  });
});

describe('statusMapper', () => {
  it('passes through when no error', async () => {
    const ctx = mkCtx();
    await statusMapper()(ctx, async () => {});
  });

  it.each([
    [401, UnauthorizedError],
    [403, ForbiddenError],
    [404, NotFoundError],
    [409, ConflictError],
  ])('status %i → %s', async (status, ErrCtor) => {
    const ctx = mkCtx();
    const raw = Object.assign(new Error(`HTTP ${status}`), { status });
    await expect(
      statusMapper()(ctx, async () => {
        throw raw;
      }),
    ).rejects.toBeInstanceOf(ErrCtor);
  });

  it.each([500, 502, 503])('status >= 500 → ServerError (status=%i)', async (status) => {
    const ctx = mkCtx();
    const raw = Object.assign(new Error(`HTTP ${status}`), { status });
    const caught: any = await Promise.resolve(
      statusMapper()(ctx, async () => {
        throw raw;
      }),
    ).catch((e) => e);
    expect(caught).toBeInstanceOf(ServerError);
    expect(caught.status).toBe(status);
  });

  it.each([
    [401, UnauthorizedError],
    [403, ForbiddenError],
    [404, NotFoundError],
    [409, ConflictError],
  ])('HttpError(%i) → %s (новый путь, без bare-Error fallback)', async (status, ErrCtor) => {
    const ctx = mkCtx();
    const httpErr = new HttpError(status, new Response(null, { status }));
    await expect(
      statusMapper()(ctx, async () => {
        throw httpErr;
      }),
    ).rejects.toBeInstanceOf(ErrCtor);
  });

  it('HttpError(500+) → ServerError, status preserved', async () => {
    const ctx = mkCtx();
    const httpErr = new HttpError(503, new Response(null, { status: 503 }));
    const caught: any = await Promise.resolve(
      statusMapper()(ctx, async () => {
        throw httpErr;
      }),
    ).catch((e) => e);
    expect(caught).toBeInstanceOf(ServerError);
    expect(caught.status).toBe(503);
    expect(caught.cause).toBe(httpErr);
  });

  it('HttpError with unmapped status → rethrows as-is', async () => {
    const ctx = mkCtx();
    const httpErr = new HttpError(418, new Response(null, { status: 418 }));
    const caught: any = await Promise.resolve(
      statusMapper()(ctx, async () => {
        throw httpErr;
      }),
    ).catch((e) => e);
    expect(caught).toBe(httpErr);
  });

  it('already-ApiError passes through unchanged', async () => {
    const ctx = mkCtx();
    const tagged = new TimeoutError();
    const caught: any = await Promise.resolve(
      statusMapper()(ctx, async () => {
        throw tagged;
      }),
    ).catch((e) => e);
    expect(caught).toBe(tagged);
  });

  it('error without .status rethrows raw', async () => {
    const ctx = mkCtx();
    const raw = new Error('weird');
    const caught: any = await Promise.resolve(
      statusMapper()(ctx, async () => {
        throw raw;
      }),
    ).catch((e) => e);
    expect(caught).toBe(raw);
    expect(caught).not.toBeInstanceOf(ApiError);
  });

  it('cause is preserved on the typed error', async () => {
    const ctx = mkCtx();
    const raw = Object.assign(new Error('HTTP 401'), { status: 401 });
    const caught: any = await Promise.resolve(
      statusMapper()(ctx, async () => {
        throw raw;
      }),
    ).catch((e) => e);
    expect(caught.cause).toBe(raw);
  });
});

describe('on401', () => {
  it('runs handler on UnauthorizedError, then rethrows', async () => {
    const ctx = mkCtx();
    const handler = vi.fn();
    await expect(
      on401(handler)(ctx, async () => {
        throw new UnauthorizedError();
      }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('ignores other errors', async () => {
    const ctx = mkCtx();
    const handler = vi.fn();
    await expect(
      on401(handler)(ctx, async () => {
        throw new NotFoundError();
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(handler).not.toHaveBeenCalled();
  });

  it('awaits async handler', async () => {
    const ctx = mkCtx();
    let resolved = false;
    const handler = async () => {
      await new Promise((r) => setTimeout(r, 5));
      resolved = true;
    };
    await Promise.resolve(
      on401(handler)(ctx, async () => {
        throw new UnauthorizedError();
      }),
    ).catch(() => {});
    expect(resolved).toBe(true);
  });
});

describe('log', () => {
  it('logs success path with → and ← ok markers', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const ctx = mkCtx({ method: 'GET', url: '/users' });
    await log()(ctx, async () => {});
    const calls = spy.mock.calls.map((c) => c[0]);
    expect(calls[0]).toMatch(/→ GET .*\/users/);
    expect(calls[1]).toMatch(/← GET ok .*\/users/);
    spy.mockRestore();
  });

  it('logs error path with ← err, then rethrows', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = mkCtx({ method: 'POST', url: '/x' });
    await expect(
      log()(ctx, async () => {
        throw new Error('nope');
      }),
    ).rejects.toThrow('nope');
    expect(warnSpy.mock.calls[0][0]).toMatch(/← POST err .*\/x/);
    spy.mockRestore();
    warnSpy.mockRestore();
  });
});

describe('retry', () => {
  it('retries on NetworkError up to max times, then throws', async () => {
    const ctx = mkCtx();
    let calls = 0;
    const next = async () => {
      calls += 1;
      throw new NetworkError();
    };
    await expect(retry({ max: 2, baseDelayMs: 0 })(ctx, next)).rejects.toBeInstanceOf(NetworkError);
    expect(calls).toBe(3); // initial + 2 retries
  });

  it('retries on ServerError', async () => {
    const ctx = mkCtx();
    let calls = 0;
    const next = async () => {
      calls += 1;
      throw new ServerError(503);
    };
    await Promise.resolve(retry({ max: 1, baseDelayMs: 0 })(ctx, next)).catch(() => {});
    expect(calls).toBe(2);
  });

  it('does NOT retry on UnauthorizedError (not in default shouldRetry)', async () => {
    const ctx = mkCtx();
    let calls = 0;
    const next = async () => {
      calls += 1;
      throw new UnauthorizedError();
    };
    await Promise.resolve(retry({ max: 5, baseDelayMs: 0 })(ctx, next)).catch(() => {});
    expect(calls).toBe(1);
  });

  it('custom shouldRetry takes precedence', async () => {
    const ctx = mkCtx();
    let calls = 0;
    const next = async () => {
      calls += 1;
      throw new UnauthorizedError();
    };
    await Promise.resolve(
      retry({
        max: 2,
        baseDelayMs: 0,
        shouldRetry: () => true,
      })(ctx, next),
    ).catch(() => {});
    expect(calls).toBe(3);
  });

  it('returns on first success without retry', async () => {
    const ctx = mkCtx();
    let calls = 0;
    const next = async () => {
      calls += 1;
    };
    await retry({ max: 5, baseDelayMs: 0 })(ctx, next);
    expect(calls).toBe(1);
  });
});
