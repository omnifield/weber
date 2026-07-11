/**
 * Программный канал HCA-событий (порт use-emit.ts предка, ADR 032 капсулы).
 * Близнец DOM-dispatch'а ui-proxy:
 *   emit('onDrop', partial) → normalizeTarget → ctx.controller[name](target, ctx.store.ctx)
 *
 * Legacy sink-forward (EmitContext, ADR-053 предка) НЕ портирован — embedded-
 * механика уедет с remote-волной своим швом.
 */

import type { ICtx, ITarget } from '@weber/kernel';
import { Context, deriveName, getTargetData } from '@weber/kernel';
import { useContext } from 'solid-js';
import type { EmitFn } from './interfaces';

/**
 * Нормализует `Partial<ITarget>` до полного target'а — зеркалит сборку в
 * ui-proxy, но без DOM-события (нет currentTarget/keyboard state).
 */
export const normalizeTarget = (partial: Partial<ITarget> = {}): ITarget => {
  const derivedName = partial.meta ? deriveName(partial.meta) : undefined;
  const base = getTargetData(
    undefined,
    {
      name: partial.name,
      value: partial.value,
      meta: partial.meta,
      dynamicMeta: partial.dynamicMeta,
      payload: partial.payload,
    },
    derivedName,
  );

  // `from` — контракт logic-уровня, не входит в getTargetData.
  return {
    ...base,
    ...(partial.key !== undefined ? { key: partial.key } : {}),
    ...(partial.modifiers !== undefined ? { modifiers: partial.modifiers } : {}),
    ...(partial.from !== undefined ? { from: partial.from } : {}),
  };
};

/**
 * Фабрика emit по готовому ctx. Замыкание читает `ctx.controller` и
 * `ctx.store.ctx` ЛЕНИВО при каждом вызове — тайминг инициализации не ломается.
 */
export const createEmit =
  (ctx: ICtx<any, any>): EmitFn =>
  (eventName, partial) => {
    const target = normalizeTarget(partial);
    return (ctx.controller as any)[eventName](target, ctx.store.ctx);
  };

/**
 * Hook: emit в ближайший Controller/Feature по тому же пути, что DOM-события.
 * @throws вне логик-scope (app-код, где логик-родитель обязателен).
 */
export const useEmit = (): EmitFn => {
  const ctx = useContext(Context);
  if (!ctx) {
    throw new Error(
      '[useEmit] must be used inside a Controller/Feature scope — no logic Context found.',
    );
  }
  return createEmit(ctx);
};

/**
 * Non-throwing близнец для библиотечного кода с ОПЦИОНАЛЬНЫМ логик-scope:
 * вне scope возвращает no-op (событие тихо дропается).
 */
export const useEmitOptional = (): EmitFn => {
  const ctx = useContext(Context);
  if (!ctx) return () => undefined;
  return createEmit(ctx);
};
