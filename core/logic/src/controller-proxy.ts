/**
 * ControllerProxy — schema-driven dispatch (порт капсульного controller-proxy.ts).
 *
 * `controller.<method>(target, ctx)` резолвит хендлер:
 * `schema.states[current][method]` → `schema[method]` (top-level) → `next()`
 * автобабблинг к родителю. FSM-переходы — через `state.set(name)` (goto-модель).
 *
 * Отличие от предка: `context`, который несёт bubbling, — уже ЧИСТЫЙ
 * user-контекст (`store.ctx` порта отдаёт данные без машинной обёртки),
 * unwrap `.data` не нужен.
 */

import type { ICtx, IStateApi, ITarget } from '@weber/kernel';
import type { EmitFn, ILogicSchemaFull, INext } from './interfaces';
import type { IStoreFacade } from './store-facade';

export interface IControllerProxyParams {
  schema: ILogicSchemaFull<any>;
  stateApi: IStateApi;
  store: IStoreFacade<any>;
  parent?: ICtx<any, any>;
  /** Ремап имён при bubble: `{ localName: parentName }`. */
  overrides?: Record<string, string>;
  /** Программный emit в собственный контроллер (ленивое замыкание из wrapper'а). */
  emit?: EmitFn;
}

export const ControllerProxy = ({
  schema,
  stateApi,
  store,
  parent,
  overrides,
  emit,
}: IControllerProxyParams): any => {
  return new Proxy({} as any, {
    get(_, methodName: string) {
      // системные поля
      if (methodName === 'store') return store;

      return async (target: ITarget, context: any) => {
        const current = stateApi.current;
        const stateHandlers = schema.states?.[current];
        const method = stateHandlers?.[methodName] ?? (schema as any)[methodName];

        // Bubble-helper: один путь для `next()` и `next.with(arg)` — разница
        // только в `from` у enriched-target'а. `?? null` выравнивает undefined
        // от optional-chain к обещанному null.
        const callParent = async <T = any>(enrichedTarget: ITarget): Promise<T | null> => {
          if (!parent?.controller) return null;
          const targetMethod = overrides?.[methodName] ?? methodName;
          return (
            (await (parent.controller as any)[targetMethod]?.(enrichedTarget, context)) ?? null
          );
        };

        const next = (async <T = any>(): Promise<T | null> =>
          callParent<T>({ ...target, from: undefined })) as INext;
        next.with = async <T = any>(arg: unknown): Promise<T | null> =>
          callParent<T>({ ...target, from: arg });

        // метод не найден — автобабблинг к родителю
        if (typeof method !== 'function') return await next();

        // Нейтральный fallback: emit не прокинут (тесты без wrapper'а) → no-op.
        const safeEmit: EmitFn = emit ?? (() => undefined);

        try {
          return await method({
            target,
            context,
            next,
            store,
            state: stateApi,
            emit: safeEmit,
          });
        } catch (err) {
          console.error(`[logic] метод "${methodName}" в стейте "${current}" упал:`, err);
          // Централизованный hook `schema.onError` — не должен разрушать pipe
          // или прятать оригинальную ошибку (она всегда re-throw'ится ниже).
          const onError = schema.onError;
          if (typeof onError === 'function') {
            try {
              const r = onError({
                target,
                context,
                next,
                store,
                state: stateApi,
                emit: safeEmit,
                error: err,
                method: methodName,
              });
              if (r && typeof (r as Promise<unknown>).catch === 'function') {
                (r as Promise<unknown>).catch((handlerErr) =>
                  console.error('[logic] onError async threw:', handlerErr),
                );
              }
            } catch (handlerErr) {
              console.error('[logic] onError sync threw:', handlerErr);
            }
          }
          throw err;
        }
      };
    },
  });
};
