import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { QueryClient } from '../../client';
import {
  ConflictError,
  ForbiddenError,
  NetworkError,
  NotFoundError,
  ServerError,
  UnauthorizedError,
} from '../../errors';
import { streamSse, streamSseJson } from '../index';

// ─── Хелперы ─────────────────────────────────────────────────────────────────

function makeStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

function makeSseBody(...events: Array<{ event: string; data: unknown }>): string {
  return events
    .map(({ event, data }) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    .join('');
}

/** Stub глобального fetch с заданным ответом. */
function stubFetch(response: Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response),
  );
}

/** Stub fetch для SSE-стрима. */
function stubFetchStream(events: Array<{ event: string; data: unknown }>, status = 200) {
  const body = makeSseBody(...events);
  const response = new Response(makeStream(body), {
    status,
    headers: { 'Content-Type': 'text/event-stream' },
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response),
  );
  return response;
}

async function collectSse(iterable: AsyncIterable<{ event: string; data: string }>) {
  const result: Array<{ event: string; data: string }> = [];
  for await (const frame of iterable) {
    result.push(frame);
  }
  return result;
}

/** Типобезопасное извлечение аргументов вызова vi.fn через double-cast. */
function getCallArgs(spy: ReturnType<typeof vi.fn>, callIndex = 0): [string, RequestInit] {
  return spy.mock.calls[callIndex] as unknown as [string, RequestInit];
}

// ─── Setup/teardown ───────────────────────────────────────────────────────────

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── streamSse — базовый сценарий ─────────────────────────────────────────────

describe('streamSse — базовый сценарий', () => {
  it('yield-ит SseFrame для каждого кадра', async () => {
    stubFetchStream([
      { event: 'token', data: { content: 'Hello' } },
      { event: 'done', data: { content: 'Hello' } },
    ]);

    const frames = await collectSse(streamSse({ path: '/chat/stream' }));

    expect(frames).toHaveLength(2);
    expect(frames[0].event).toBe('token');
    expect(JSON.parse(frames[0].data)).toMatchObject({ content: 'Hello' });
    expect(frames[1].event).toBe('done');
  });

  it('использует POST по умолчанию', async () => {
    const spy = vi.fn(
      async () =>
        new Response(makeStream('event: done\ndata: {}\n\n'), {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
    );
    vi.stubGlobal('fetch', spy);

    await collectSse(streamSse({ path: '/stream' }));

    expect(spy).toHaveBeenCalledOnce();
    const [, init] = getCallArgs(spy);
    expect(init.method).toBe('POST');
  });

  it('поддерживает кастомный метод (GET)', async () => {
    const spy = vi.fn(
      async () =>
        new Response(makeStream('event: ping\ndata: {}\n\n'), {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
    );
    vi.stubGlobal('fetch', spy);

    await collectSse(streamSse({ path: '/stream', method: 'GET' }));

    const [, init] = getCallArgs(spy);
    expect(init.method).toBe('GET');
  });
});

// ─── streamSse — сериализация тела ────────────────────────────────────────────

describe('streamSse — body', () => {
  it('JSON-объект → stringify + Content-Type: application/json', async () => {
    const spy = vi.fn(
      async () =>
        new Response(makeStream('event: done\ndata: {}\n\n'), {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
    );
    vi.stubGlobal('fetch', spy);

    await collectSse(streamSse({ path: '/stream', body: { prompt: 'hi' } }));

    const [, init] = getCallArgs(spy);
    expect(init.body).toBe(JSON.stringify({ prompt: 'hi' }));
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('строка передаётся as-is, Content-Type не ставится', async () => {
    const spy = vi.fn(
      async () =>
        new Response(makeStream('event: done\ndata: {}\n\n'), {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
    );
    vi.stubGlobal('fetch', spy);

    await collectSse(streamSse({ path: '/stream', body: 'raw' }));

    const [, init] = getCallArgs(spy);
    expect(init.body).toBe('raw');
    expect((init.headers as Record<string, string>)?.['Content-Type']).toBeUndefined();
  });

  it('явный Content-Type в headers не перезаписывается', async () => {
    const spy = vi.fn(
      async () =>
        new Response(makeStream('event: done\ndata: {}\n\n'), {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
    );
    vi.stubGlobal('fetch', spy);

    await collectSse(
      streamSse({
        path: '/stream',
        body: { x: 1 },
        headers: { 'Content-Type': 'application/x-ndjson' },
      }),
    );

    const [, init] = getCallArgs(spy);
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/x-ndjson');
  });
});

// ─── streamSse — резолв URL ────────────────────────────────────────────────────

describe('streamSse — URL резолв', () => {
  it('baseUrl + path → склеивает', async () => {
    const spy = vi.fn(
      async () =>
        new Response(makeStream('event: done\ndata: {}\n\n'), {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
    );
    vi.stubGlobal('fetch', spy);

    await collectSse(streamSse({ baseUrl: 'https://api.example.com', path: '/chat/stream' }));

    const [url] = getCallArgs(spy);
    expect(url).toBe('https://api.example.com/chat/stream');
  });

  it('абсолютный path → используется as-is (игнорирует baseUrl)', async () => {
    const spy = vi.fn(
      async () =>
        new Response(makeStream('event: done\ndata: {}\n\n'), {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
    );
    vi.stubGlobal('fetch', spy);

    await collectSse(
      streamSse({
        baseUrl: 'https://other.com',
        path: 'https://direct.example.com/stream',
      }),
    );

    const [url] = getCallArgs(spy);
    expect(url).toBe('https://direct.example.com/stream');
  });

  it('QueryClient.bases резолвит base → URL prefix', async () => {
    const spy = vi.fn(
      async () =>
        new Response(makeStream('event: done\ndata: {}\n\n'), {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
    );
    vi.stubGlobal('fetch', spy);

    const client = new QueryClient({
      bases: { default: '/api', scriber: 'https://scriber.example.com' },
    });

    await collectSse(streamSse({ client, base: 'scriber', path: '/chat/stream' }));

    const [url] = getCallArgs(spy);
    expect(url).toBe('https://scriber.example.com/chat/stream');
  });

  it('QueryClient.bases default base если base не указан', async () => {
    const spy = vi.fn(
      async () =>
        new Response(makeStream('event: done\ndata: {}\n\n'), {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
    );
    vi.stubGlobal('fetch', spy);

    const client = new QueryClient({ bases: { default: '/api' } });

    await collectSse(streamSse({ client, path: '/stream' }));

    const [url] = getCallArgs(spy);
    expect(url).toBe('/api/stream');
  });

  it('QueryClient.defaultHeaders объединяются с headers конфига', async () => {
    const spy = vi.fn(
      async () =>
        new Response(makeStream('event: done\ndata: {}\n\n'), {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
    );
    vi.stubGlobal('fetch', spy);

    const client = new QueryClient({
      bases: { default: '/api' },
      defaultHeaders: { Authorization: 'Bearer token', Accept: 'text/event-stream' },
    });

    await collectSse(streamSse({ client, path: '/stream', headers: { 'X-Custom': 'yes' } }));

    const [, init] = getCallArgs(spy);
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer token');
    expect(headers.Accept).toBe('text/event-stream');
    expect(headers['X-Custom']).toBe('yes');
  });

  it('headers конфига перезаписывают defaultHeaders', async () => {
    const spy = vi.fn(
      async () =>
        new Response(makeStream('event: done\ndata: {}\n\n'), {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
    );
    vi.stubGlobal('fetch', spy);

    const client = new QueryClient({
      bases: { default: '/api' },
      defaultHeaders: { Authorization: 'Bearer old' },
    });

    await collectSse(
      streamSse({
        client,
        path: '/stream',
        headers: { Authorization: 'Bearer new' },
      }),
    );

    const [, init] = getCallArgs(spy);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer new');
  });
});

// ─── streamSse — ошибки ───────────────────────────────────────────────────────

describe('streamSse — HTTP ошибки', () => {
  it('401 → UnauthorizedError', async () => {
    stubFetch(new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' }));
    await expect(collectSse(streamSse({ path: '/stream' }))).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('403 → ForbiddenError', async () => {
    stubFetch(new Response('Forbidden', { status: 403, statusText: 'Forbidden' }));
    await expect(collectSse(streamSse({ path: '/stream' }))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('404 → NotFoundError', async () => {
    stubFetch(new Response('Not Found', { status: 404, statusText: 'Not Found' }));
    await expect(collectSse(streamSse({ path: '/stream' }))).rejects.toBeInstanceOf(NotFoundError);
  });

  it('409 → ConflictError', async () => {
    stubFetch(new Response('Conflict', { status: 409, statusText: 'Conflict' }));
    await expect(collectSse(streamSse({ path: '/stream' }))).rejects.toBeInstanceOf(ConflictError);
  });

  it('500 → ServerError', async () => {
    stubFetch(
      new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' }),
    );
    await expect(collectSse(streamSse({ path: '/stream' }))).rejects.toBeInstanceOf(ServerError);
  });

  it('503 → ServerError', async () => {
    stubFetch(
      new Response('Service Unavailable', {
        status: 503,
        statusText: 'Service Unavailable',
      }),
    );
    await expect(collectSse(streamSse({ path: '/stream' }))).rejects.toBeInstanceOf(ServerError);
  });

  it('ServerError несёт правильный status', async () => {
    stubFetch(new Response('Server Error', { status: 503, statusText: 'Service Unavailable' }));
    const err = (await collectSse(streamSse({ path: '/stream' })).catch((e) => e)) as ServerError;
    expect(err.status).toBe(503);
  });
});

describe('streamSse — NetworkError', () => {
  it('fetch throw (connection refused) → NetworkError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    await expect(collectSse(streamSse({ path: '/stream' }))).rejects.toBeInstanceOf(NetworkError);
  });

  it('response.body === null → NetworkError', async () => {
    stubFetch(
      new Response(null, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
    );
    await expect(collectSse(streamSse({ path: '/stream' }))).rejects.toBeInstanceOf(NetworkError);
  });
});

// ─── streamSse — AbortSignal ──────────────────────────────────────────────────

describe('streamSse — AbortSignal', () => {
  it('прокидывает signal в fetch', async () => {
    const spy = vi.fn(
      async () =>
        new Response(makeStream('event: done\ndata: {}\n\n'), {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
    );
    vi.stubGlobal('fetch', spy);

    const controller = new AbortController();
    await collectSse(streamSse({ path: '/stream', signal: controller.signal }));

    const [, init] = getCallArgs(spy);
    expect(init.signal).toBe(controller.signal);
  });
});

// ─── streamSseJson ────────────────────────────────────────────────────────────

describe('streamSseJson', () => {
  it('JSON-парсит data каждого кадра', async () => {
    stubFetchStream([
      { event: 'token', data: { content: 'A', n: 1 } },
      { event: 'done', data: { content: 'A', n: 2 } },
    ]);

    const results: unknown[] = [];
    for await (const item of streamSseJson({ path: '/stream' })) {
      results.push(item);
    }

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ content: 'A', n: 1 });
    expect(results[1]).toEqual({ content: 'A', n: 2 });
  });

  it('валидирует каждый кадр через zod-схему', async () => {
    stubFetchStream([{ event: 'token', data: { type: 'token', content: 'hello' } }]);

    const TokenSchema = z.object({ type: z.literal('token'), content: z.string() });
    const results: Array<z.infer<typeof TokenSchema>> = [];

    for await (const item of streamSseJson({ path: '/stream' }, TokenSchema)) {
      results.push(item);
    }

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ type: 'token', content: 'hello' });
  });

  it('бросает ZodError если кадр не соответствует схеме', async () => {
    stubFetchStream([{ event: 'token', data: { type: 'WRONG', content: 123 } }]);

    const TokenSchema = z.object({ type: z.literal('token'), content: z.string() });

    // collectSse с any чтобы обойти тип — важен сам факт броска
    async function drainJson() {
      for await (const _ of streamSseJson({ path: '/stream' }, TokenSchema)) {
        // consume
      }
    }
    await expect(drainJson()).rejects.toThrow();
  });

  it('бросает SyntaxError если data не является валидным JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(makeStream('event: token\ndata: not-valid-json\n\n'), {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          }),
      ),
    );

    async function drainJson() {
      for await (const _ of streamSseJson({ path: '/stream' })) {
        // consume
      }
    }
    await expect(drainJson()).rejects.toThrow(SyntaxError);
  });

  it('без схемы → возвращает unknown (JSON.parse без валидации)', async () => {
    stubFetchStream([{ event: 'ping', data: { ts: 42 } }]);

    const results: unknown[] = [];
    for await (const item of streamSseJson({ path: '/stream' })) {
      results.push(item);
    }

    expect(results[0]).toEqual({ ts: 42 });
  });
});
