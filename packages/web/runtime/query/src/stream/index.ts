/**
 * Streaming-транспорт для web-query.
 *
 * Лежит в транспортном слое web-query — переиспользует иерархию ошибок
 * (`HttpError` → `UnauthorizedError` / `ServerError` / ...) и `bases`-резолв
 * через `QueryClient`, но НЕ участвует в pipeline (validateInput / cache /
 * middleware) — потому что у стрима нет одного «ответа».
 *
 * ### Интеграция с bases
 *
 * `StreamConfig.base` — ключ из `QueryClientOptions.bases` (тот же словарь,
 * что и у `httpTransport`). Резолв делегируется в `QueryClient.resolveStreamUrl`
 * — приватный метод того же класса что резолвит URL для `fetch`/`mutate`.
 * Если `client` не передан — используется готовый `baseUrl` как-есть.
 *
 * @module
 */

import type { ZodType } from 'zod';
import type { QueryClient } from '../client';
import {
  ConflictError,
  ForbiddenError,
  HttpError,
  NetworkError,
  NotFoundError,
  ServerError,
  UnauthorizedError,
} from '../errors';
import type { HttpMethod } from '../types';
import type { SseFrame } from './sse-parser';
import { parseSseStream } from './sse-parser';

export type { SseFrame } from './sse-parser';
export { parseSseFrame, parseSseStream } from './sse-parser';

// ─── Конфиг стримингового запроса ────────────────────────────────────────────

/**
 * Конфигурация стримингового SSE-запроса.
 *
 * Интеграция с `bases`:
 *  - `client` + `base` → URL = `client.bases[base] + path` (рекомендуется).
 *  - `baseUrl` + `path` → URL = `baseUrl + path` (если QueryClient недоступен).
 *  - `path` начинается с `http` → используется as-is (абсолютный URL).
 */
export interface StreamConfig {
  /**
   * Относительный путь запроса (например `/chat/stream`).
   * Если начинается с `http` — интерпретируется как абсолютный URL
   * (игнорирует `base` / `baseUrl`).
   */
  path: string;

  /**
   * HTTP-метод. Большинство стриминговых эндпоинтов используют `POST`
   * (чтобы передать тело). Default: `'POST'`.
   */
  method?: HttpMethod;

  /** JSON-сериализуемое тело запроса. */
  body?: unknown;

  /** Дополнительные заголовки (объединяются с `defaultHeaders` QueryClient'а). */
  headers?: Record<string, string>;

  /** AbortSignal для отмены запроса. */
  signal?: AbortSignal;

  /**
   * Ключ в `QueryClientOptions.bases` — выбирает базовый URL.
   * Работает только при передаче `client`. По умолчанию `'default'`.
   */
  base?: string;

  /**
   * Базовый URL как строка — альтернатива `base`+`client`.
   * Игнорируется если передан `client` (который знает свои `bases`).
   */
  baseUrl?: string;

  /**
   * QueryClient для резолва `bases` и слияния `defaultHeaders`.
   * Если не передан — используется `baseUrl` напрямую.
   */
  client?: QueryClient;
}

// ─── Внутренний резолв URL ────────────────────────────────────────────────────

/**
 * Резолвит итоговый URL запроса:
 *  1. Абсолютный `path` → as-is.
 *  2. `client` + `base` → берём prefix из `client.getBases()[base]`.
 *  3. `baseUrl` → `baseUrl + path`.
 *  4. Иначе → `path` как-есть.
 */
function resolveStreamUrl(config: StreamConfig): string {
  const { path, base = 'default', baseUrl, client } = config;

  // Абсолютный URL — используем как есть
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  if (client) {
    const prefix = client.getBases()[base] ?? '';
    return `${prefix}${path}`;
  }

  if (baseUrl != null) {
    return `${baseUrl}${path}`;
  }

  return path;
}

// ─── Слияние заголовков ───────────────────────────────────────────────────────

function mergeHeaders(config: StreamConfig): Record<string, string> {
  const defaultHeaders = config.client ? config.client.getDefaultHeaders() : {};
  return { ...defaultHeaders, ...(config.headers ?? {}) };
}

// ─── Маппинг HTTP-статуса → typed ApiError ───────────────────────────────────

/**
 * Конвертит `HttpError` в типизированную ошибку из иерархии web-query —
 * та же логика что у `mw.statusMapper()` в pipeline.
 */
function mapHttpError(err: HttpError): Error {
  const status = err.status ?? 0;
  if (status === 401) return new UnauthorizedError({ cause: err });
  if (status === 403) return new ForbiddenError({ cause: err });
  if (status === 404) return new NotFoundError({ cause: err });
  if (status === 409) return new ConflictError({ cause: err });
  if (status >= 500) return new ServerError(status, { cause: err });
  return err; // 4xx прочие — возвращаем HttpError as-is
}

// ─── Основная функция стриминга ───────────────────────────────────────────────

/**
 * Делает fetch-запрос к SSE-эндпоинту и yield'ит сырые `SseFrame`'ы.
 *
 * Переиспользует:
 *  - `bases`-резолв (через `config.client.getBases()`).
 *  - `defaultHeaders` QueryClient'а.
 *  - Иерархию ошибок web-query (`HttpError` → `UnauthorizedError` / `ServerError` / ...).
 *  - `AbortSignal`.
 *
 * НЕ участвует в pipeline (validateInput / validateResponse / cache).
 *
 * @example
 * ```ts
 * // В Feature:
 * const client = getQueryClient();
 * for await (const frame of streamSse({ client, path: '/chat/stream', body: { prompt } })) {
 *   if (frame.event === 'token') store.update({ text: store.ctx.data.text + JSON.parse(frame.data).content });
 * }
 * ```
 */
export async function* streamSse(config: StreamConfig): AsyncIterable<SseFrame> {
  const url = resolveStreamUrl(config);
  const headers = mergeHeaders(config);
  const method = config.method ?? 'POST';

  // JSON-body → Content-Type: application/json (если не переопределён явно)
  let bodyInit: BodyInit | undefined;
  if (config.body != null) {
    if (
      typeof config.body === 'string' ||
      config.body instanceof FormData ||
      config.body instanceof Blob
    ) {
      bodyInit = config.body as BodyInit;
    } else {
      bodyInit = JSON.stringify(config.body);
      if (!headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'application/json';
      }
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: bodyInit,
      signal: config.signal,
    });
  } catch (err) {
    // Сетевая ошибка (DNS, connection refused, abort до начала ответа)
    throw new NetworkError({ cause: err });
  }

  if (!response.ok) {
    // Прочитываем body до throw — аналогично defaultFetcher
    const bodyText = await response.text().catch(() => null);
    const httpErr = new HttpError(response.status, response, { bodyText });
    throw mapHttpError(httpErr);
  }

  if (response.body === null) {
    throw new NetworkError({ cause: new Error('Response body is null — server sent no stream') });
  }

  yield* parseSseStream(response.body);
}

// ─── Типизированный вариант с опциональной zod-валидацией ────────────────────

/**
 * Как `streamSse`, но JSON-парсит `frame.data` и опционально валидирует
 * через переданную zod-схему.
 *
 * Если схема не передана — возвращает `unknown` (JSON.parse без валидации).
 * Если JSON.parse падает — пробрасывает SyntaxError.
 *
 * @example
 * ```ts
 * import { z } from 'zod';
 * const TokenEvent = z.object({ type: z.literal('token'), content: z.string() });
 *
 * for await (const event of streamSseJson({ client, path: '/chat/stream', body }, TokenEvent)) {
 *   store.update({ text: store.ctx.data.text + event.content });
 * }
 * ```
 */
export async function* streamSseJson<T = unknown>(
  config: StreamConfig,
  schema?: ZodType<T>,
): AsyncIterable<T> {
  for await (const frame of streamSse(config)) {
    const parsed: unknown = JSON.parse(frame.data);
    if (schema) {
      yield schema.parse(parsed) as T;
    } else {
      yield parsed as T;
    }
  }
}
