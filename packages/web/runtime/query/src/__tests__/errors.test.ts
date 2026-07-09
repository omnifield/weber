import { describe, expect, it } from 'vitest';
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
  ValidationError,
} from '../errors';

// Иерархия типизированных ошибок. Тесты держат:
//   - instanceof chain (ApiError — общий супер-класс);
//   - .name = имя конкретного класса (через new.target.name);
//   - .code / .status / .payload / .cause — стабильные поля.

describe('ApiError — base shape', () => {
  it('extends Error, exposes code/status/payload/cause', () => {
    const cause = new Error('inner');
    const e = new ApiError('boom', { code: 'x', status: 418, payload: { a: 1 }, cause });
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(ApiError);
    expect(e.message).toBe('boom');
    expect(e.code).toBe('x');
    expect(e.status).toBe(418);
    expect(e.payload).toEqual({ a: 1 });
    expect(e.cause).toBe(cause);
    expect(e.name).toBe('ApiError');
  });

  it('cause устанавливается через native Error.cause (ES2022) — видно в Object.getOwnPropertyDescriptor', () => {
    const cause = new Error('inner');
    const e = new ApiError('boom', { code: 'x', cause });
    // Native Error.cause лежит на own-property самого Error (не на ApiError).
    // Проверяем что прототипный путь видит cause — это значит super(message, {cause}) сработал.
    const desc = Object.getOwnPropertyDescriptor(e, 'cause');
    expect(desc).toBeDefined();
    expect(desc?.value).toBe(cause);
  });

  it('без cause — поле undefined, дескриптор отсутствует (не ставим лишний own-property)', () => {
    const e = new ApiError('boom', { code: 'x' });
    expect(e.cause).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(e, 'cause')).toBeUndefined();
  });
});

describe.each([
  ['UnauthorizedError', UnauthorizedError, 'unauthorized', 401],
  ['ForbiddenError', ForbiddenError, 'forbidden', 403],
  ['NotFoundError', NotFoundError, 'not_found', 404],
  ['ConflictError', ConflictError, 'conflict', 409],
])('%s', (name, Ctor, code, status) => {
  it(`has code='${code}', status=${status}, name='${name}', extends ApiError`, () => {
    const e = new (Ctor as any)();
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toBeInstanceOf(Ctor);
    expect(e.code).toBe(code);
    expect(e.status).toBe(status);
    expect(e.name).toBe(name);
  });
});

describe('ServerError', () => {
  it('accepts arbitrary 5xx, code is always server_error', () => {
    const e = new ServerError(503);
    expect(e.code).toBe('server_error');
    expect(e.status).toBe(503);
    expect(e.name).toBe('ServerError');
  });
});

describe.each([
  ['NetworkError', NetworkError, 'network_error'],
  ['TimeoutError', TimeoutError, 'timeout'],
])('%s', (name, Ctor, code) => {
  it(`has code='${code}', no status, name='${name}'`, () => {
    const e = new (Ctor as any)();
    expect(e.code).toBe(code);
    expect(e.status).toBeUndefined();
    expect(e.name).toBe(name);
  });
});

describe('HttpError', () => {
  it('carries status + Response, message reflects statusText, code = "http"', () => {
    const res = new Response('not found', { status: 404, statusText: 'Not Found' });
    const e = new HttpError(404, res);
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toBeInstanceOf(HttpError);
    expect(e.status).toBe(404);
    expect(e.response).toBe(res);
    expect(e.code).toBe('http');
    expect(e.name).toBe('HttpError');
    expect(e.message).toMatch(/HTTP 404 Not Found/);
  });

  it('preserves cause when provided', () => {
    const cause = new Error('inner');
    const e = new HttpError(500, new Response(null, { status: 500 }), { cause });
    expect(e.cause).toBe(cause);
  });

  it('bodyText: null когда не передан', () => {
    const e = new HttpError(500, new Response(null, { status: 500 }));
    expect(e.bodyText).toBeNull();
  });

  it('bodyText: сохраняет переданный текст (прочитанный defaultFetcher-ом до throw)', () => {
    const e = new HttpError(500, new Response(null, { status: 500 }), {
      bodyText: '{"error":"oops"}',
    });
    expect(e.bodyText).toBe('{"error":"oops"}');
  });

  it('bodyText: null если кастомный fetcher явно передал null (read failure)', () => {
    const e = new HttpError(500, new Response(null, { status: 500 }), { bodyText: null });
    expect(e.bodyText).toBeNull();
  });
});

describe('ValidationError', () => {
  it('carries phase + issues + payload = issues', () => {
    const issues = [{ path: ['x'], message: 'required' } as any];
    const e = new ValidationError('request', issues);
    expect(e.phase).toBe('request');
    expect(e.issues).toBe(issues);
    expect(e.payload).toBe(issues);
    expect(e.code).toBe('validation');
    expect(e.name).toBe('ValidationError');
    expect(e.status).toBeUndefined();
  });
});
