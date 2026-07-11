import type { ICtx } from '@weber/kernel';
import { Context } from '@weber/kernel';
import type { JSX } from 'solid-js';
import {
  createEffect,
  createUniqueId,
  mergeProps,
  onCleanup,
  splitProps,
  useContext,
} from 'solid-js';
import { hasAccessResolver, resolveAccess } from './access';
import type { IUiProxyConventions } from './conventions';
import { resolveConventions } from './conventions';
import { type AnyEvent, deriveInputType, deriveName, getTargetData } from './derivation';

const safeCall = (fn: any, ...args: any[]) => {
  try {
    const r = fn?.(...args);
    if (r && typeof r.catch === 'function') {
      r.catch((err: any) => console.error('[UiProxy] async handler failed:', err));
    }
    return r;
  } catch (err) {
    console.error('[UiProxy] sync handler threw:', err);
  }
};

/**
 * Является ли аргумент события DOM-Event'ом (имеет `currentTarget`).
 * Kobalte-style компоненты зовут onChange/onInput с raw-значением — тогда
 * `e` сам является значением, дедуп и модификаторы не применяются.
 */
const isDomEvent = (e: unknown): e is AnyEvent =>
  typeof e === 'object' && e !== null && 'currentTarget' in e;

/** Публичная поверхность (API) модуля ui-proxy. */
export interface IUiProxyApi {
  /** Итоговые конвенции инстанса (дефолты ⊕ overrides). */
  readonly conventions: IUiProxyConventions;
  /** Dedup-маркер события этого инстанса (внутренний контракт, экспорт для тестов). */
  eventMarker(name: string): string;
  /**
   * Proxy над ЛЮБЫМ ui-kit'ом: каждый доступ к компоненту возвращает
   * meta-opt-in обёртку; ключи из `rawPassthroughKeys` отдаются как есть.
   */
  proxy(kit: Record<string, any>, ctx: ICtx<any, any>, wrapperProps: any): Record<string, any>;
  /**
   * Оборачивает один компонент (или namespace с подкомпонентами) — тот же
   * wrap, что использует `proxy` через Proxy.get; экспортирован для тестов
   * и composite-потребителей.
   */
  wrapComponent(
    ctx: ICtx<any, any>,
    wrapperProps: any,
    OriginalComponent: any,
    componentName?: string,
  ): any;
  /**
   * Events-only binder для composite-внутренних строк (Table.Row и т.д.):
   * target-построение + те же события с тем же дедупом, БЕЗ регистрации в
   * store и без id. Один вызов на call-site (вне render-loop).
   */
  bindEvents<P>(ctx: ICtx<any, any>, Comp: (props: P) => JSX.Element): (props: P) => JSX.Element;
}

/**
 * Фабрика инстанса модуля: конвенции → API. Hot-path прекомпьюты
 * (EVENT_ENTRIES с готовыми маркерами) выполняются один раз здесь.
 */
export const createUiProxy = (overrides?: Partial<IUiProxyConventions>): IUiProxyApi => {
  const conventions = resolveConventions(overrides);
  const { events, kindTags, tagToInputType, rawPassthroughKeys } = conventions;

  const eventMarker = (name: string): string =>
    `${conventions.eventMarkerPrefix}${name}${conventions.eventMarkerSuffix}`;

  const EVENT_ENTRIES: ReadonlyArray<{ name: string; updateStore: boolean; marker: string }> =
    Object.entries(events).map(([name, { updateStore }]) => ({
      name,
      updateStore,
      marker: eventMarker(name),
    }));

  /**
   * Строит event-handlers с дедупликацией bubbling и диспатчем в
   * ctx.controller. Общий для full-path (`wrapComponent`) и events-only
   * (`bindEvents`).
   */
  const buildEventBindings = (
    ctx: ICtx<any, any>,
    getEffMeta: () => any,
    getProps: () => any,
    onUpdateStore?: (data: ReturnType<typeof getTargetData>) => void,
  ): Record<string, (e: AnyEvent) => void> => {
    const bindings: Record<string, (e: AnyEvent) => void> = {};
    for (const { name, updateStore, marker } of EVENT_ENTRIES) {
      bindings[name] = (e: AnyEvent) => {
        const isNativeDomEvent = isDomEvent(e);

        // Дедуп bubbling: первый handler маркирует event, обёртки выше по
        // DOM-цепочке скипают. Raw-value аргументы (kobalte) не маркируются —
        // bubble у них не происходит.
        if (isNativeDomEvent) {
          if ((e as any)[marker]) return;
          (e as any)[marker] = true;
        }

        const props = getProps();
        const effectiveMeta = getEffMeta();

        const domEvent: AnyEvent | undefined = isNativeDomEvent ? e : undefined;
        const rawValue: unknown = isNativeDomEvent ? undefined : e;

        const data = getTargetData(
          domEvent,
          { ...props, meta: effectiveMeta },
          deriveName(effectiveMeta),
          rawValue,
        );
        if (updateStore && data.name && onUpdateStore) {
          onUpdateStore(data);
        }
        safeCall((ctx.controller as any)[name], data, ctx.store.ctx);
        // Оригинальный аргумент — пользовательскому обработчику (e или raw value).
        safeCall(props[name], e);
      };
    }
    return bindings;
  };

  const bindEvents = <P,>(
    ctx: ICtx<any, any>,
    Comp: (props: P) => JSX.Element,
  ): ((props: P) => JSX.Element) => {
    return (props: P) => {
      // meta/payload потребляются (нужны только target-построению) — иначе
      // осядут на DOM-узле как [object Object].
      const hca = props as P & { meta?: any; payload?: unknown };
      const { meta, payload, ...rest } = hca as any;

      const getEffMeta = () => meta;
      const getProps = () => ({ ...rest, meta, payload });

      const eventBindings = buildEventBindings(ctx, getEffMeta, getProps);

      const finalProps = mergeProps(rest, eventBindings) as P;
      const C = Comp as any;
      return <C {...finalProps} />;
    };
  };

  const wrapComponent = (
    ctx: ICtx<any, any>,
    wrapperProps: any,
    OriginalComponent: any,
    componentName?: string,
  ): any => {
    if (!OriginalComponent) return undefined;

    if (typeof OriginalComponent !== 'function' && typeof OriginalComponent !== 'object') {
      return OriginalComponent;
    }

    // kind-tag примитива (undefined вне whitelist). Один раз на wrap-time.
    const kindTag = componentName ? kindTags[componentName] : undefined;

    const ComponentWrapper = (componentProps: any) => {
      const merged = mergeProps(wrapperProps, componentProps, {
        dynamicMeta: wrapperProps?.meta,
      });
      const [local, props] = splitProps(merged, ['children']);

      // Динамический резолв ctx: ближайший enclosing Provider, fallback —
      // захваченный ctx (обеспечивает next()-bubbling во вложенную логику).
      const liveCtx = useContext(Context) ?? ctx;

      // Политика C: регистрация и event-binding ТОЛЬКО при СОБСТВЕННОМ meta
      // на JSX-узле. Унаследованный dynamicMeta — не повод регистрировать
      // структурные обёртки.
      const hasOwnMeta = !!componentProps?.meta;

      if (!hasOwnMeta) {
        const finalProps = mergeProps(props, local);
        return <OriginalComponent {...finalProps} />;
      }

      // Access-gating (meta.can), реактивно в render-скоупе; без резолвера —
      // fast-path мимо. meta.denied === 'disable' → рендер disabled; иначе null.
      if (hasAccessResolver()) {
        const cap: string | undefined = componentProps.meta?.can;
        if (cap && !resolveAccess(cap)) {
          if (componentProps.meta?.denied === 'disable') {
            const disabledProps = mergeProps(props, local, { disabled: true });
            return <OriginalComponent {...disabledProps} />;
          }
          return null;
        }
      }

      const id = createUniqueId();

      // Геттер effective meta: при обновлении props.meta все читатели ниже
      // получают свежий объект с kind-tag (без дублирования тега).
      const getEffectiveMeta = () => {
        const baseMeta = props.meta;
        if (!kindTag) return baseMeta;
        const userTags: readonly string[] = baseMeta?.tags ?? [];
        const tagsWithKind = userTags.includes(kindTag) ? userTags : [...userTags, kindTag];
        return { ...baseMeta, tags: tagsWithKind };
      };

      // Реактивная регистрация: mount + любое изменение props.
      createEffect(() => {
        const effectiveMeta = getEffectiveMeta();
        const name = deriveName(effectiveMeta);
        liveCtx.store.registerComponent({
          [id]: { ...props, meta: effectiveMeta, ...(name ? { name } : {}) },
        });
      });

      onCleanup(() => {
        liveCtx.store.unregisterComponent(id);
      });

      const eventBindings = buildEventBindings(
        liveCtx,
        getEffectiveMeta,
        () => props,
        (data) => {
          // Patch только runtime-меняющихся полей; meta/name уже в
          // components[id] через registerComponent.
          liveCtx.store.updateComponent({ [id]: { value: data.value, type: data.type } });
        },
      );

      const dynamicProps = {
        get class() {
          const name = deriveName(getEffectiveMeta());
          const custom = name ? liveCtx.store.styles?.[name] || '' : '';
          return `${props.class || ''} ${custom}`.trim();
        },
        // name — для нативных DOM-элементов (form-data, a11y).
        get name() {
          return deriveName(getEffectiveMeta());
        },
        // type инпута из тега; явный props.type автора выигрывает.
        get type() {
          return props.type ?? deriveInputType(getEffectiveMeta(), tagToInputType);
        },
        ...eventBindings,
      };

      // Порядок mergeProps: props < dynamicProps < patch'и логики
      // (store.props[id], передан ФУНКЦИЕЙ — реактивность на каждом чтении)
      // < children. `disabled` НЕ инжектится автоматически (поведение —
      // за логическим слоем: явный props.disabled или store.props-patch).
      const finalProps = mergeProps(
        props,
        dynamicProps,
        () => liveCtx.store.props?.[id] ?? {},
        local,
      );
      return <OriginalComponent {...finalProps} />;
    };

    return new Proxy(ComponentWrapper, {
      get(target, prop: string) {
        const subComponent = (OriginalComponent as any)[prop];
        if (subComponent) {
          // Sub-components (Card.Header и т.д.): componentName не передаём —
          // kind-tag авто-инжект для них не нужен.
          return wrapComponent(ctx, wrapperProps, subComponent);
        }
        return (target as any)[prop];
      },
    });
  };

  const proxy = (kit: Record<string, any>, ctx: ICtx<any, any>, wrapperProps: any) =>
    new Proxy(
      { ...kit },
      {
        get(target, propName: string) {
          if (rawPassthroughKeys.has(propName)) {
            return (target as any)[propName];
          }
          return wrapComponent(ctx, wrapperProps, (target as any)[propName], propName);
        },
      },
    );

  return { conventions, eventMarker, proxy, wrapComponent, bindEvents };
};
