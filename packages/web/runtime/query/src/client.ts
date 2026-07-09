import { keyToString, QueryCache } from './cache';
import { defaultFetcher } from './fetcher';
import type {
  ErrorInterceptor,
  FetchOptions,
  MutateOptions,
  QueryClientOptions,
  QueryKey,
  RequestConfig,
  RequestInterceptor,
  ResponseInterceptor,
} from './types';

interface ResolvedOpts {
  bases: Record<string, string>;
  defaultHeaders: Record<string, string>;
  defaultStaleTime: number;
  fetcher?: QueryClientOptions['fetcher'];
  interceptors: {
    request: RequestInterceptor[];
    response: ResponseInterceptor[];
    error: ErrorInterceptor[];
  };
}

const toErrorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/**
 * Главный класс — управляет кэшем, dedupe, interceptor-цепочками,
 * resolve'ом URL по `bases`. Создаётся через `createQueryClient(...)`.
 */
export class QueryClient {
  private cache = new QueryCache();
  private opts: ResolvedOpts;

  constructor(opts: QueryClientOptions = {}) {
    this.opts = {
      bases: opts.bases ?? { default: '' },
      defaultHeaders: opts.defaultHeaders ?? {},
      defaultStaleTime: opts.defaultStaleTime ?? 0,
      fetcher: opts.fetcher,
      interceptors: {
        request: opts.interceptors?.request ?? [],
        response: opts.interceptors?.response ?? [],
        error: opts.interceptors?.error ?? [],
      },
    };
  }

  /** Склеивает `bases[base]` + `url` + сериализованные `params`. */
  private resolveUrl(req: RequestConfig): string {
    const base = this.opts.bases[req.base ?? 'default'] ?? '';
    const url = (req.url ?? '').startsWith('http') ? (req.url ?? '') : `${base}${req.url ?? ''}`;
    if (!req.params) return url;
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(req.params)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) {
        for (const item of v) {
          if (item === undefined || item === null) continue;
          qs.append(k, String(item));
        }
      } else {
        qs.append(k, String(v));
      }
    }
    const qsStr = qs.toString();
    if (!qsStr) return url;
    return url + (url.includes('?') ? '&' : '?') + qsStr;
  }

  /**
   * Прогоняет запрос через interceptor-цепочку:
   *  request → fetcher → response → (на ошибке) error.
   * Каждый interceptor может вернуть Promise — все awaited по очереди.
   */
  private async runRequest(req: RequestConfig): Promise<unknown> {
    let next: RequestConfig = {
      ...req,
      headers: { ...this.opts.defaultHeaders, ...(req.headers ?? {}) },
    };
    for (const inter of this.opts.interceptors.request) next = await inter(next);

    const resolvedUrl = this.resolveUrl(next);
    const fetcher = next.fetcher ?? this.opts.fetcher ?? defaultFetcher;

    try {
      let res = await fetcher({ ...next, resolvedUrl });
      for (const inter of this.opts.interceptors.response) res = await inter(res, next);
      return res;
    } catch (err) {
      let final: unknown = err;
      for (const inter of this.opts.interceptors.error) {
        try {
          final = await inter(final, next);
        } catch (e) {
          final = e;
        }
      }
      throw final;
    }
  }

  /**
   * Cached GET-style запрос. Возвращает Promise<data>:
   *  - cache hit + fresh (`now - fetchedAt < staleTime`) → отдаёт `data` синхронно из кэша.
   *  - cache miss / stale → запрашивает; параллельные вызовы шарят один in-flight Promise.
   *  - на ошибке — бросает (вызыватель catch'ит); `syncTo` пишет error в store.
   */
  async fetch<T = unknown>(key: QueryKey, opts: FetchOptions = {}): Promise<T> {
    const staleTime = opts.staleTime ?? this.opts.defaultStaleTime;
    const now = Date.now();

    const existing = this.cache.get<T>(key);

    // Fresh cache hit
    if (existing?.state.status === 'success' && now - existing.state.fetchedAt < staleTime) {
      return existing.state.data as T;
    }

    // In-flight dedupe
    if (existing?.inFlight) return existing.inFlight;

    const entry = existing ?? {
      key,
      state: { data: undefined, error: undefined, status: 'idle' as const, fetchedAt: 0 },
      inFlight: null,
    };
    entry.state.status = 'loading';
    opts.syncTo?.setLoading(true);

    const promise = this.runRequest(opts).then(
      (data) => {
        entry.state = {
          data: data as T,
          error: undefined,
          status: 'success',
          fetchedAt: Date.now(),
        };
        entry.inFlight = null;
        opts.syncTo?.setLoading(false);
        return data as T;
      },
      (err) => {
        entry.state = { ...entry.state, error: err, status: 'error', fetchedAt: Date.now() };
        entry.inFlight = null;
        opts.syncTo?.setLoading(false);
        opts.syncTo?.setErrors({ [keyToString(key)]: toErrorMessage(err) });
        throw err;
      },
    );
    entry.inFlight = promise as Promise<unknown> as Promise<T>;
    this.cache.set(key, entry);

    return promise;
  }

  /**
   * Uncached mutation (POST/PUT/DELETE). Дефолтный method = `'POST'`.
   * После успеха инвалидирует `invalidates`. `syncTo` пишет loading/errors.
   */
  async mutate<T = unknown>(opts: MutateOptions): Promise<T> {
    opts.syncTo?.setLoading(true);
    try {
      const result = await this.runRequest({ method: 'POST', ...opts });
      for (const k of opts.invalidates ?? []) this.cache.invalidate(k);
      opts.syncTo?.setLoading(false);
      return result as T;
    } catch (err) {
      opts.syncTo?.setLoading(false);
      opts.syncTo?.setErrors({ [opts.name ?? 'mutation']: toErrorMessage(err) });
      throw err;
    }
  }

  /** Превентивный fetch — заполняет кэш, ошибки глотает. Для preload-кейсов. */
  async prefetch<T = unknown>(key: QueryKey, opts: FetchOptions = {}): Promise<void> {
    try {
      await this.fetch<T>(key, opts);
    } catch {
      /* prefetch не должен ронять caller */
    }
  }

  /** Прямая запись в кэш — для optimistic updates / SSR-гидратации. */
  setQueryData<T>(key: QueryKey, data: T): void {
    const entry = this.cache.get<T>(key) ?? {
      key,
      state: { data: undefined, error: undefined, status: 'idle' as const, fetchedAt: 0 },
      inFlight: null,
    };
    entry.state = { data, error: undefined, status: 'success', fetchedAt: Date.now() };
    this.cache.set(key, entry);
  }

  /** Синхронное чтение текущего значения из кэша. */
  getQueryData<T = unknown>(key: QueryKey): T | undefined {
    return this.cache.get<T>(key)?.state.data;
  }

  /**
   * Возвращает карту `bases` этого клиента.
   * Используется стриминговым транспортом (`streamSse`) для резолва baseURL
   * без дублирования логики.
   */
  getBases(): Record<string, string> {
    return this.opts.bases;
  }

  /**
   * Возвращает `defaultHeaders` этого клиента.
   * Используется стриминговым транспортом (`streamSse`) для слияния заголовков.
   */
  getDefaultHeaders(): Record<string, string> {
    return this.opts.defaultHeaders;
  }

  /**
   * Помечает все matched по префиксу cache-entries как stale. Следующий `fetch`
   * по этим ключам сходит в сеть. Не удаляет данные — UI продолжает их видеть
   * до прихода свежих. Пример: `invalidate(['users'])` бьёт все `['users', ...]`.
   */
  invalidate(key: QueryKey): void {
    this.cache.invalidate(key);
  }

  /** Полностью удаляет cache-entry. */
  remove(key: QueryKey): void {
    this.cache.delete(key);
  }

  /** Полностью очищает весь кэш. */
  clear(): void {
    this.cache.clear();
  }
}

export const createQueryClient = (opts?: QueryClientOptions): QueryClient => new QueryClient(opts);

// ------------------------------------------------------------------
// Module-level singleton — выставляется приложением через setQueryClient
// при старте; используется core (createLogicWrapper) для инжекта в Feature.
// Per-app: каждый bundle имеет свой module-graph → свой singleton.
// ------------------------------------------------------------------
let _client: QueryClient | undefined;

export const setQueryClient = (client: QueryClient): void => {
  _client = client;
};

export const getQueryClient = (): QueryClient | undefined => _client;
