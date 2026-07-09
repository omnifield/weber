import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HttpError } from '../errors';
import { defaultFetcher } from '../fetcher';

// defaultFetcher: тонкая обёртка над глобальным fetch. JSON-serialize body,
// JSON-parse/text/blob по Content-Type, бросает Error с .status на non-2xx.

const stubFetch = (response: Response) => {
  const spy = vi.fn(async () => response) as unknown as typeof fetch;
  vi.stubGlobal('fetch', spy);
  return spy;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('defaultFetcher — JSON parsing', () => {
  it('parses application/json body', async () => {
    stubFetch(
      new Response(JSON.stringify({ a: 1 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const out = await defaultFetcher({ method: 'GET', resolvedUrl: '/x' });
    expect(out).toEqual({ a: 1 });
  });

  it('returns text() for text/* content-type', async () => {
    stubFetch(new Response('hello', { status: 200, headers: { 'content-type': 'text/plain' } }));
    const out = await defaultFetcher({ method: 'GET', resolvedUrl: '/x' });
    expect(out).toBe('hello');
  });

  it('returns undefined for 204 No Content', async () => {
    stubFetch(new Response(null, { status: 204 }));
    const out = await defaultFetcher({ method: 'GET', resolvedUrl: '/x' });
    expect(out).toBeUndefined();
  });

  it('returns blob() for binary content-type', async () => {
    stubFetch(
      new Response(new Blob(['xx']), {
        status: 200,
        headers: { 'content-type': 'application/octet-stream' },
      }),
    );
    const out = await defaultFetcher({ method: 'GET', resolvedUrl: '/x' });
    expect(out).toBeInstanceOf(Blob);
  });
});

describe('defaultFetcher — body serialization', () => {
  it('object body → JSON.stringify + Content-Type header', async () => {
    const spy = stubFetch(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    await defaultFetcher({ method: 'POST', resolvedUrl: '/x', body: { hi: 1 } });
    const init = (spy as any).mock.calls[0][1] as RequestInit;
    expect(init.body).toBe(JSON.stringify({ hi: 1 }));
    expect((init.headers as any)['Content-Type']).toBe('application/json');
  });

  it('string body — passed through, no JSON header added', async () => {
    const spy = stubFetch(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    await defaultFetcher({ method: 'POST', resolvedUrl: '/x', body: 'raw' });
    const init = (spy as any).mock.calls[0][1] as RequestInit;
    expect(init.body).toBe('raw');
  });

  it('FormData body passed through', async () => {
    const spy = stubFetch(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const fd = new FormData();
    fd.append('k', 'v');
    await defaultFetcher({ method: 'POST', resolvedUrl: '/x', body: fd });
    expect((spy as any).mock.calls[0][1].body).toBe(fd);
  });

  it('Blob body passed through', async () => {
    const spy = stubFetch(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const blob = new Blob(['x']);
    await defaultFetcher({ method: 'POST', resolvedUrl: '/x', body: blob });
    expect((spy as any).mock.calls[0][1].body).toBe(blob);
  });
});

describe('defaultFetcher — non-2xx', () => {
  it('throws Error with .status + .response on 4xx/5xx', async () => {
    stubFetch(new Response('not found', { status: 404, statusText: 'Not Found' }));
    const err = (await defaultFetcher({ method: 'GET', resolvedUrl: '/x' }).catch(
      (e) => e,
    )) as HttpError;
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/HTTP 404/);
    expect(err.status).toBe(404);
    expect(err.response).toBeInstanceOf(Response);
  });

  it('reads response body before throw — HttpError.bodyText содержит текст', async () => {
    stubFetch(new Response('{"error":"oops"}', { status: 500, statusText: 'Server Error' }));
    const err = (await defaultFetcher({ method: 'GET', resolvedUrl: '/x' }).catch(
      (e) => e,
    )) as HttpError;
    expect(err.bodyText).toBe('{"error":"oops"}');
  });

  it('bodyText = "" для пустого тела (а не null)', async () => {
    stubFetch(new Response(null, { status: 500 }));
    const err = (await defaultFetcher({ method: 'GET', resolvedUrl: '/x' }).catch(
      (e) => e,
    )) as HttpError;
    expect(err.bodyText).toBe('');
  });

  it('Response.body уже consumed — повторное чтение возвращает пусто (документируем поведение)', async () => {
    stubFetch(new Response('body-was-here', { status: 500 }));
    const err = (await defaultFetcher({ method: 'GET', resolvedUrl: '/x' }).catch(
      (e) => e,
    )) as HttpError;
    // bodyText прочитан defaultFetcher-ом.
    expect(err.bodyText).toBe('body-was-here');
    // Response.body теперь locked/used — повторный .text() вернёт пусто либо упадёт.
    // Это намеренное ограничение: consumer должен пользоваться bodyText.
    expect(err.response.bodyUsed).toBe(true);
  });
});

describe('defaultFetcher — request init', () => {
  it('passes method/headers/signal/credentials through', async () => {
    const spy = stubFetch(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const signal = new AbortController().signal;
    await defaultFetcher({
      method: 'PATCH',
      resolvedUrl: '/x',
      headers: { Accept: 'application/json' },
      signal,
      credentials: 'include',
    });
    const init = (spy as any).mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('PATCH');
    expect(init.headers).toEqual({ Accept: 'application/json' });
    expect(init.signal).toBe(signal);
    expect(init.credentials).toBe('include');
  });

  it('defaults method to GET', async () => {
    const spy = stubFetch(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    await defaultFetcher({ resolvedUrl: '/x' });
    expect((spy as any).mock.calls[0][1].method).toBe('GET');
  });
});
