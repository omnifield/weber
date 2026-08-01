/**
 * Обёртки UI-слоёв (порт капсульных view/page/widget.tsx) — фабрики,
 * параметризованные окружением сборки. Что у предка было вшито намертво,
 * здесь приходит из env:
 *  - КИТ (`Ui as BaseUi` из '../ui-kit' предка) → `env.kit` (любой кит);
 *  - UiProxy-механика → инстанс модуля ui-proxy;
 *  - trace (жёсткий импорт web-profiler) → слот;
 *  - Outlet/router НЕ вшиты — придут в составе кита при сборке (router-волна).
 * Settings-strip предка (web-style coupling + сырые классы в коре) НЕ портирован —
 * фича вернётся инъекцией с kit/style-волной (см. OWNERSHIP).
 */

import type { ICtx } from '@omnifield/weber-kernel';
import { useCtx } from '@omnifield/weber-kernel';
import type { IStoreFacade } from '@omnifield/weber-logic';
import type { IUiProxyApi } from '@omnifield/weber-ui-proxy';
import type { JSX } from 'solid-js';
import { children, createUniqueId, onCleanup, Show } from 'solid-js';
import { ShapeUiContext } from './shape/context';

export type TraceFn = (
  node: string,
  phase: 'mount' | 'dispose',
  data?: Record<string, unknown>,
) => void;

export interface IWrappersEnv {
  kit: Record<string, unknown>;
  uiProxy: IUiProxyApi;
  trace?: TraceFn;
}

export type Kit = Record<string, any>;

/** View: stateless JSX, `(Ui, props) => JSX`. */
export type ViewRenderer<P = any> = (Ui: Kit, props: P) => JSX.Element;
/** Widget/Page: композиция с доступом к store-фасаду, `(Ui, store, props) => JSX`. */
export type BlockRenderer<P = any> = (
  Ui: Kit,
  store: IStoreFacade<any> | undefined,
  props: P,
) => JSX.Element;

export interface IWidgetOptions {
  /** Loader-swap: при `store.loading === true` рендерится loader вместо контента. */
  loader?: (Ui: Kit, props: any) => JSX.Element;
}

const useTrace = (env: IWrappersEnv, node: string) => {
  const id = createUniqueId();
  env.trace?.(node, 'mount', { id });
  onCleanup(() => env.trace?.(node, 'dispose', { id }));
};

export const createWrappers = (env: IWrappersEnv) => {
  const proxied = (ctx: ICtx<any, any> | undefined, wrapperProps: unknown): Kit =>
    ctx ? env.uiProxy.proxy(env.kit, ctx, wrapperProps) : (env.kit as Kit);

  const View =
    <P,>(Component: ViewRenderer<P>) =>
    (wrapperProps: P) => {
      useTrace(env, 'weber.view');
      const ctx = useCtx();

      // View вне Controller-tree — UiProxy не активируется: разрешено
      // (Storybook и т.п.), но для user-кода обычно ошибка интеграции.
      if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV && !ctx) {
        console.warn(
          '[View] rendered outside of Controller — UiProxy is disabled, ' +
            'meta-tagged elements in this subtree are decorative.',
        );
      }

      const Ui = proxied(ctx, wrapperProps);
      return (
        <ShapeUiContext.Provider value={Ui}>{Component(Ui, wrapperProps)}</ShapeUiContext.Provider>
      );
    };

  const Page =
    <P,>(Component: BlockRenderer<P>) =>
    (wrapperProps: P) => {
      useTrace(env, 'weber.page');
      // Pages обычно root-level (без логик-родителя) — кит проходит сырым;
      // прокси доступен для редкого случая Page внутри Controller-поддерева.
      const ctx = useCtx();
      const Ui = proxied(ctx, wrapperProps);
      return (
        <ShapeUiContext.Provider value={Ui}>
          {Component(Ui, ctx?.store as IStoreFacade<any> | undefined, wrapperProps)}
        </ShapeUiContext.Provider>
      );
    };

  const Widget =
    <P,>(Component: BlockRenderer<P>, options?: IWidgetOptions) =>
    (wrapperProps: P) => {
      useTrace(env, 'weber.widget');
      const ctx = useCtx();
      const store = ctx?.store as IStoreFacade<any> | undefined;
      const Ui = proxied(ctx, wrapperProps);

      const Loader = options?.loader;
      const isLoading = () => Boolean(Loader && store?.loading);

      // Единственный инстанс контента через children(): при loader-swap контент
      // не инстанцируется за лоадером (контракт предка); двойного вызова
      // Component на mount нет (грабля ADR 062 предка — bug A, дубль-инстанс).
      const WidgetContent = () => {
        const content = children(() => Component(Ui, store, wrapperProps));
        return content();
      };

      return (
        <ShapeUiContext.Provider value={Ui}>
          <Show when={!isLoading()} fallback={Loader?.(Ui, wrapperProps)}>
            <WidgetContent />
          </Show>
        </ShapeUiContext.Provider>
      );
    };

  return { View, Page, Widget };
};
