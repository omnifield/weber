import type { QueryClient } from './client';
import type { EndpointConfig } from './endpoint';
import type { RequestConfig } from './types';

/**
 * Koa-style middleware: получает контекст и `next()`, должен вызвать `next()`
 * чтобы пропустить управление дальше по цепочке. Работа до `await next()` —
 * pre-phase (видит «сырые» input/request), после — post-phase (видит response/data).
 */
export type Middleware<C = ApiContext> = (
  ctx: C,
  next: () => Promise<void>,
) => Promise<void> | void;

/**
 * Объект, который путешествует через всю pipeline одного вызова endpoint'а.
 * Каждый middleware пишет в свой слот:
 *  - `validateInput` — нормализует `ctx.input` (после zod-parse);
 *  - `buildRequest`  — заполняет `ctx.request`;
 *  - `transport`     — заполняет `ctx.response`;
 *  - `validateResponse` — нормализует `ctx.response` (после zod-parse);
 *  - `mapDomain`     — заполняет `ctx.data` (финальное значение для caller'а).
 *
 * `meta` — свободный bag для пользовательских mw (trace-id, timing'и, что угодно).
 */
export interface ApiContext {
  endpointName: string;
  config: EndpointConfig;
  client: QueryClient;
  input: unknown;
  request: RequestConfig;
  response?: unknown;
  data?: unknown;
  meta: Record<string, unknown>;
}

/**
 * Composes middleware-array in koa-style: каждый mw оборачивает следующие,
 * `next()` диспатчит на следующий. Двойной вызов `next()` в одном mw — ошибка.
 */
export const compose =
  <C>(mw: ReadonlyArray<Middleware<C>>) =>
  async (ctx: C): Promise<void> => {
    let lastIndex = -1;
    const dispatch = async (i: number): Promise<void> => {
      if (i <= lastIndex) throw new Error('next() called multiple times');
      lastIndex = i;
      const fn = mw[i];
      if (!fn) return;
      await fn(ctx, () => dispatch(i + 1));
    };
    await dispatch(0);
  };
