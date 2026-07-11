import { createContext, useContext } from 'solid-js';
import type { ICtx } from './ports';

/**
 * Единый Solid-Context HCA-runtime'а. Живёт в kernel, чтобы у ВСЕХ модулей
 * (ui-proxy, logic, …) была одна identity контекста — динамический резолв
 * «ближайший enclosing Provider» работает поверх этого одного объекта.
 */
export const Context = createContext<ICtx>();

/** Контекстный hook для обёрток/приложений. */
export const useCtx = <TCtx = unknown, TState = unknown>() =>
  useContext(Context) as ICtx<TCtx, TState>;

/**
 * Фабрика типизированного хука для пакетных потребителей: пакет создаёт
 * свой hook один раз (`export const useEditor = createUseCtx<IEditorCtx>()`),
 * kernel при появлении нового пакета не меняется.
 */
export const createUseCtx =
  <TCtx = unknown, TState = unknown>() =>
  () =>
    useContext(Context) as ICtx<TCtx, TState>;

/**
 * Контракт «composite wrap» — шов логика↔кит для composite-строк (Table.Row,
 * List.Item …): кит берёт wrap из контекста и получает event-binding, НЕ зная
 * механик кора. Value провайдит logic-модуль (обычно bindEvents из ui-proxy,
 * связывается при сборке). Живёт в kernel ради единой identity.
 */
export interface ICompositeWrap {
  wrap<P>(Comp: (props: P) => unknown): (props: P) => unknown;
}

export const CompositeWrapContext = createContext<ICompositeWrap>();

export const useCompositeWrap = () => useContext(CompositeWrapContext);
