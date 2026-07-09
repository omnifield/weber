import { NetworkError, ValidationError } from '../errors';
import type { Middleware } from '../pipeline';
import type { RequestConfig } from '../types';

const PATH_PARAM = /:(\w+)/g;

/** Прогоняет `ctx.input` через `endpoint.request` zod-схему. Если схемы нет — no-op. */
export const validateInput = (): Middleware => async (ctx, next) => {
  const schema = ctx.config.request;
  if (schema) {
    const parsed = schema.safeParse(ctx.input);
    if (!parsed.success) throw new ValidationError('request', parsed.error.issues);
    ctx.input = parsed.data;
  }
  await next();
};

/**
 * Превращает `ctx.input` в `ctx.request`:
 *  - подставляет `:param`-плейсхолдеры из соответствующих полей input'а;
 *  - оставшиеся поля — в `params` (для GET/HEAD/DELETE) или в `body` (иначе).
 */
export const buildRequest = (): Middleware => async (ctx, next) => {
  const { method, path, base } = ctx.config;
  const input = (ctx.input ?? {}) as Record<string, unknown>;

  const usedKeys = new Set<string>();
  const url = path.replace(PATH_PARAM, (_, key: string) => {
    usedKeys.add(key);
    const value = input[key];
    if (value === undefined || value === null) {
      throw new Error(`Missing path param ":${key}" for endpoint ${ctx.endpointName}`);
    }
    return encodeURIComponent(String(value));
  });

  const rest: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (!usedKeys.has(k)) rest[k] = v;
  }

  const hasBody = method !== 'GET' && method !== 'HEAD' && method !== 'DELETE';
  const req: RequestConfig = { method, url, base };
  if (hasBody) {
    if (Object.keys(rest).length > 0) req.body = rest;
  } else {
    // Передаём rest как есть — `client.resolveUrl` сам решает что делать с
    // undefined/null/массивами. Раньше тут было ручное `String(v)`-преобразование,
    // которое теряло массивы и схлопывало undefined в строку "undefined".
    const params: RequestConfig['params'] = {};
    let hasAny = false;
    for (const [k, v] of Object.entries(rest)) {
      if (v === undefined || v === null) continue;
      params[k] = v as RequestConfig['params'] extends Record<string, infer V> ? V : never;
      hasAny = true;
    }
    if (hasAny) req.params = params;
  }
  ctx.request = req;

  await next();
};

/**
 * HTTP-transport: дёргает `QueryClient.fetch` (для GET) или `.mutate` (иначе).
 * Кэш используется только на GET — остальное uncached mutation.
 *
 * `QueryClient` уже умеет кидать `Error` с `.status` на non-2xx — это сырое
 * исключение пробрасывается дальше, `statusMapper` конвертит в типизированное.
 */
export const httpTransport = (): Middleware => async (ctx, next) => {
  const { method } = ctx.request;
  const client = ctx.client;

  try {
    if (method === 'GET') {
      ctx.response = await client.fetch(
        ['__endpoint', ctx.endpointName, (ctx.input ?? null) as object | null],
        { ...ctx.request, staleTime: ctx.config.staleTime },
      );
    } else {
      ctx.response = await client.mutate({ ...ctx.request, name: ctx.endpointName });
    }
  } catch (err) {
    if (err && typeof (err as { status?: number }).status === 'number') throw err;
    throw new NetworkError({ cause: err });
  }

  await next();
};

/** Прогоняет `ctx.response` через `endpoint.response` zod-схему. */
export const validateResponse = (): Middleware => async (ctx, next) => {
  const schema = ctx.config.response;
  if (schema) {
    const parsed = schema.safeParse(ctx.response);
    if (!parsed.success) throw new ValidationError('response', parsed.error.issues);
    ctx.response = parsed.data;
  }
  await next();
};

/** Применяет `endpoint.map(dto)` — финальная domain-форма. Если `map` не задан — `data = response`. */
export const mapDomain = (): Middleware => async (ctx, next) => {
  ctx.data = ctx.config.map ? ctx.config.map(ctx.response) : ctx.response;
  await next();
};

/**
 * Per-endpoint pre-request hook (см. `endpoint.ts > PreRequest`). Запускается
 * **после** `validateInput` (input уже zod-parsed) и **до** `buildRequest`.
 *
 * Контракт:
 *  - `setInput(next)` мутирует `ctx.input` для downstream pipeline.
 *  - `resolve(data)` — short-circuit: пишет `ctx.data` и НЕ вызывает `next()`.
 *    `buildRequest` / `httpTransport` / `validateResponse` / `mapDomain` —
 *    пропущены. Caller передаёт уже **финальный** domain shape.
 *  - `reject(err)` — short-circuit с throw'ом.
 *  - Двойной `resolve()` / `reject()` — `Error` («called more than once»).
 *  - Если хэндлера нет — middleware прозрачно делегирует `next()`.
 *
 * Передавать данные в `resolve(data)` zod-validation НЕ проходят (`validateResponse`
 * пропущен): корректность mock-данных — ответственность caller'а.
 */
export const preRequestHook = (): Middleware => async (ctx, next) => {
  const fn = ctx.config.preRequest;
  if (!fn) return next();

  let didShortCircuit = false;
  let shortCircuitData: unknown;
  let didReject = false;
  let shortCircuitError: unknown;

  const hookCtx = {
    get input() {
      return ctx.input;
    },
    setInput: (n: unknown) => {
      ctx.input = n;
    },
    resolve: (data: unknown) => {
      if (didShortCircuit) throw new Error('preRequest: resolve()/reject() called more than once');
      didShortCircuit = true;
      shortCircuitData = data;
    },
    reject: (err: unknown) => {
      if (didShortCircuit) throw new Error('preRequest: resolve()/reject() called more than once');
      didShortCircuit = true;
      didReject = true;
      shortCircuitError = err;
    },
    endpoint: { path: ctx.config.path, method: ctx.config.method },
  };

  await (fn as (c: unknown) => void | Promise<void>)(hookCtx);

  if (didShortCircuit) {
    if (didReject) throw shortCircuitError;
    ctx.data = shortCircuitData;
    // Pipeline останавливается здесь — `next()` НЕ вызывается.
    return;
  }

  await next();
};
