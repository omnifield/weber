import {
  ApiError,
  ConflictError,
  ForbiddenError,
  HttpError,
  NotFoundError,
  ServerError,
  UnauthorizedError,
} from '../errors';
import type { Middleware } from '../pipeline';

/** Прокладывает cookies в `fetch` (требует CORS-настройки на сервере). */
export const cookies = (): Middleware => async (ctx, next) => {
  ctx.request.credentials = 'include';
  await next();
};

/**
 * Authorization-header. `getToken()` зовётся на каждый запрос — кладёт
 * актуальное значение (поддерживает refresh-токены/login-logout без перестроек pipeline).
 * Возврат `null`/`undefined` — заголовок не добавляется.
 */
export const auth = (opts: {
  scheme?: 'Bearer' | 'Basic' | string;
  header?: string;
  getToken: () => string | null | undefined | Promise<string | null | undefined>;
}): Middleware => {
  const header = opts.header ?? 'Authorization';
  const scheme = opts.scheme ?? 'Bearer';
  return async (ctx, next) => {
    const token = await opts.getToken();
    if (token) {
      ctx.request.headers = {
        ...(ctx.request.headers ?? {}),
        [header]: `${scheme} ${token}`,
      };
    }
    await next();
  };
};

/**
 * Конвертит сырую `HttpError` от `defaultFetcher` (или любую другую с .status)
 * в типизированные `UnauthorizedError`/`ForbiddenError`/`NotFoundError`/
 * `ConflictError`/`ServerError`. Размещается ПЕРВЫМ в пользовательском списке —
 * остальные `on401`/`onForbidden` уже ловят типизированный класс.
 *
 * Уже типизированные ошибки (всё, что extends ApiError, кроме сырой HttpError)
 * — pass-through.
 */
export const statusMapper = (): Middleware => async (_ctx, next) => {
  try {
    await next();
  } catch (err) {
    if (err instanceof HttpError) {
      // HttpError's constructor always sets status; ApiError types it optional.
      const status = err.status as number;
      if (status === 401) throw new UnauthorizedError({ cause: err });
      if (status === 403) throw new ForbiddenError({ cause: err });
      if (status === 404) throw new NotFoundError({ cause: err });
      if (status === 409) throw new ConflictError({ cause: err });
      if (status >= 500) throw new ServerError(status, { cause: err });
      throw err;
    }
    if (err instanceof ApiError) throw err;
    // Backward-compat для кастомных fetcher'ов, которые бросают «голый» Error
    // с прикрученным `.status` (паттерн до HttpError-класса).
    const status = (err as { status?: number } | undefined)?.status;
    if (typeof status !== 'number') throw err;
    if (status === 401) throw new UnauthorizedError({ cause: err });
    if (status === 403) throw new ForbiddenError({ cause: err });
    if (status === 404) throw new NotFoundError({ cause: err });
    if (status === 409) throw new ConflictError({ cause: err });
    if (status >= 500) throw new ServerError(status, { cause: err });
    throw err;
  }
};

/**
 * Side-effect на 401 (после `statusMapper`). Типовой сценарий: `goTo('/_auth')`.
 * Ошибка пробрасывается дальше — Feature всё равно увидит её в catch.
 */
export const on401 =
  (handler: () => void | Promise<void>): Middleware =>
  async (_ctx, next) => {
    try {
      await next();
    } catch (err) {
      if (err instanceof UnauthorizedError) await handler();
      throw err;
    }
  };

const fmt = (verb: string, url?: string) => `[api] ${verb} ${url ?? '?'}`;

/** Простой console-log per request: → method + url, ← ok / error. */
export const log = (): Middleware => async (ctx, next) => {
  const { method, url } = ctx.request;
  console.log(fmt(`→ ${method}`, url));
  try {
    await next();
    console.log(fmt(`← ${method} ok`, url));
  } catch (err) {
    console.warn(fmt(`← ${method} err`, url), err);
    throw err;
  }
};

/**
 * Retry с экспоненциальным backoff'ом. По умолчанию ретраит на NetworkError и 5xx.
 * `shouldRetry` — кастомный фильтр (получает ошибку и номер попытки начиная с 1).
 */
export const retry = (opts: {
  max?: number;
  baseDelayMs?: number;
  shouldRetry?: (err: unknown, attempt: number) => boolean;
}): Middleware => {
  const max = opts.max ?? 2;
  const base = opts.baseDelayMs ?? 200;
  const defaultShould = (err: unknown) => {
    if (err instanceof ServerError) return true;
    const code = (err as ApiError | undefined)?.code;
    return code === 'network_error' || code === 'timeout';
  };
  const should = opts.shouldRetry ?? defaultShould;
  return async (_ctx, next) => {
    let attempt = 0;
    while (true) {
      try {
        await next();
        return;
      } catch (err) {
        attempt += 1;
        if (attempt > max || !should(err, attempt)) throw err;
        await new Promise((r) => setTimeout(r, base * 2 ** (attempt - 1)));
      }
    }
  };
};
