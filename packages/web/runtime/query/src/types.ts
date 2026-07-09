import type { IBridge } from '@omnifield/web-state';

/**
 * Ключ кэша. Поддерживает префиксную инвалидацию: `['users']`
 * инвалидирует все `['users', ...]` под-кэши.
 */
export type QueryKey = readonly (string | number | boolean | null | object | undefined)[];

/** HTTP-метод запроса. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * Полный конфиг одного запроса. Используется и в `fetch` (через `FetchOptions`),
 * и в `mutate` (через `MutateOptions`), и в interceptor'ах.
 */
export interface RequestConfig {
  /** Относительный URL — присоединяется к `bases[base ?? 'default']`. */
  url?: string;
  method?: HttpMethod;
  /** Ключ в `QueryClientOptions.bases` — выбирает baseURL. По умолчанию `'default'`. */
  base?: string;
  body?: unknown;
  headers?: Record<string, string>;
  /**
   * Query-string параметры — будут добавлены к URL.
   *
   * Семантика:
   *  - `string | number | boolean` — `?k=v`.
   *  - `undefined` / `null` — ключ пропускается (skip-if-not-set).
   *  - `ReadonlyArray<...>` — multi-value: `?k=a&k=b`. Элементы `undefined`/`null`
   *    внутри массива тоже пропускаются.
   */
  params?: Record<
    string,
    | string
    | number
    | boolean
    | undefined
    | null
    | ReadonlyArray<string | number | boolean | undefined | null>
  >;
  signal?: AbortSignal;
  /** Передаётся в `fetch(... { credentials })`. Используется mw `cookies()`. */
  credentials?: RequestCredentials;
  /** Per-call override фетчера (полезно для GraphQL/gRPC). */
  fetcher?: Fetcher;
}

/** Низкоуровневый fetcher — получает уже разрешённый URL и сконфигурированный запрос. */
export type Fetcher = (req: RequestConfig & { resolvedUrl: string }) => Promise<unknown>;

export type RequestInterceptor = (req: RequestConfig) => RequestConfig | Promise<RequestConfig>;
export type ResponseInterceptor = (res: unknown, req: RequestConfig) => unknown | Promise<unknown>;
export type ErrorInterceptor = (err: unknown, req: RequestConfig) => unknown | Promise<unknown>;

/** Состояние одной cache-записи. */
export interface QueryState<T = unknown> {
  data: T | undefined;
  error: unknown;
  status: 'idle' | 'loading' | 'success' | 'error';
  /** unix-ts последнего успешного fetch — для проверки stale. `0` = stale. */
  fetchedAt: number;
}

/** Опции `fetch` (cached GET). */
export interface FetchOptions extends RequestConfig {
  /**
   * За сколько ms cache считается свежим. По истечении следующий `fetch`
   * сходит в сеть. `0` (default) — всегда refetch.
   */
  staleTime?: number;
  /**
   * Если передан — автоматом пишет `setLoading(true/false)` и
   * `setErrors({ [key]: msg })` в этот store. Без него Feature пишет руками.
   */
  syncTo?: IBridge;
}

/** Опции `mutate` (uncached POST/PUT/DELETE). */
export interface MutateOptions extends RequestConfig {
  syncTo?: IBridge;
  /**
   * Имя операции для `setErrors({ [name]: ... })`. Если не задано — `'mutation'`.
   */
  name?: string;
  /** После успеха инвалидировать эти query-keys (включая префиксы). */
  invalidates?: ReadonlyArray<QueryKey>;
}

export interface QueryClientOptions {
  /**
   * Карта baseURL'ов. Ключ — имя (для `request.base`), значение — URL prefix.
   * Запрос без `base` использует `bases.default`. Пример:
   * ```
   * bases: {
   *   default: '/api',
   *   _auth: 'https://auth.example.com',
   *   cdn: 'https://cdn.example.com',
   * }
   * ```
   */
  bases?: Record<string, string>;
  /** Стандартные header'ы для всех запросов (Authorization и т.п.). */
  defaultHeaders?: Record<string, string>;
  /** По умолчанию `0` — всегда refetch. Override per-call через `FetchOptions.staleTime`. */
  defaultStaleTime?: number;
  /** Глобальный fetcher — fallback для нестандартных backend'ов. По умолчанию HTTP. */
  fetcher?: Fetcher;
  /** Interceptor-цепочки. Применяются по порядку, могут менять request/response/error. */
  interceptors?: {
    request?: RequestInterceptor[];
    response?: ResponseInterceptor[];
    error?: ErrorInterceptor[];
  };
}
