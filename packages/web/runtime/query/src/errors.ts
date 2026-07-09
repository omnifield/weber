import type { ZodIssue } from 'zod';

/**
 * Базовый класс ошибок Omnifield API. Middleware конвертит сетевые/транспортные
 * ошибки в эту иерархию, чтобы Feature ловил типизированно:
 *
 * ```ts
 * try { ctx.user = await api.user.get({ id }); }
 * catch (e) {
 *   if (e instanceof UnauthorizedError) state.set('unauthorized');
 *   if (e instanceof ValidationError)   state.set('badData');
 * }
 * ```
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly payload?: unknown;
  // ES2022 Error.cause: устанавливается через super(message, { cause }).
  // Объявляем явно, чтобы тип был `unknown`, а не `Error | undefined` из lib.es2022.error.
  declare readonly cause?: unknown;

  constructor(
    message: string,
    opts: { code: string; status?: number; payload?: unknown; cause?: unknown },
  ) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = new.target.name;
    this.code = opts.code;
    this.status = opts.status;
    this.payload = opts.payload;
  }
}

/**
 * Сырая HTTP-ошибка от `defaultFetcher` (или совместимого fetcher'а). Несёт
 * `status`, оригинальный `Response` и `bodyText` — прочитанное тело ответа.
 *
 * **`bodyText` vs `response.text()`:** `Response.body` — стрим, читается **один
 * раз**. `defaultFetcher` читает его перед throw'ом и кладёт в `bodyText`, чтобы
 * consumer (error-interceptor, Sentry, statusMapper) мог обращаться к нему
 * многократно. `response.text()` / `.json()` после броска вернут пустую строку
 * (стрим уже выпит).
 *
 * Раньше эта роль выполнялась через `Object.assign(new Error(...), { status,
 * response })` — нетипизированный `{ status?: number }`-каст в нескольких
 * местах. Класс делает контракт явным.
 */
export class HttpError extends ApiError {
  readonly response: Response;
  /**
   * Прочитанное тело ответа (текст). `null` если чтение упало (network drop
   * посреди стрима, decoder error и т.п.) или если кастомный fetcher не
   * передал его в конструктор.
   */
  readonly bodyText: string | null;
  constructor(
    status: number,
    response: Response,
    opts: { cause?: unknown; bodyText?: string | null } = {},
  ) {
    super(`HTTP ${status} ${response.statusText}`, {
      code: 'http',
      status,
      cause: opts.cause,
    });
    this.response = response;
    this.bodyText = opts.bodyText ?? null;
  }
}

export class UnauthorizedError extends ApiError {
  constructor(opts: { payload?: unknown; cause?: unknown } = {}) {
    super('Unauthorized', { code: 'unauthorized', status: 401, ...opts });
  }
}

export class ForbiddenError extends ApiError {
  constructor(opts: { payload?: unknown; cause?: unknown } = {}) {
    super('Forbidden', { code: 'forbidden', status: 403, ...opts });
  }
}

export class NotFoundError extends ApiError {
  constructor(opts: { payload?: unknown; cause?: unknown } = {}) {
    super('Not Found', { code: 'not_found', status: 404, ...opts });
  }
}

export class ConflictError extends ApiError {
  constructor(opts: { payload?: unknown; cause?: unknown } = {}) {
    super('Conflict', { code: 'conflict', status: 409, ...opts });
  }
}

export class ServerError extends ApiError {
  constructor(status: number, opts: { payload?: unknown; cause?: unknown } = {}) {
    super(`Server error ${status}`, { code: 'server_error', status, ...opts });
  }
}

export class NetworkError extends ApiError {
  constructor(opts: { cause?: unknown } = {}) {
    super('Network error', { code: 'network_error', ...opts });
  }
}

export class TimeoutError extends ApiError {
  constructor(opts: { cause?: unknown } = {}) {
    super('Request timeout', { code: 'timeout', ...opts });
  }
}

/**
 * Невалидный input (на запрос) или невалидный response (на ответ) — zod-парсинг
 * упал. `phase` показывает где.
 */
export class ValidationError extends ApiError {
  readonly issues: readonly ZodIssue[];
  readonly phase: 'request' | 'response';

  constructor(phase: 'request' | 'response', issues: readonly ZodIssue[]) {
    super(`Validation failed (${phase})`, { code: 'validation', payload: issues });
    this.phase = phase;
    this.issues = issues;
  }
}
