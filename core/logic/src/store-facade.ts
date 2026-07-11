/**
 * Store-фасад для хендлеров: узкий IStorePort + удобства-запросы (pick/omit/
 * match/matchEntry/values/patch). Ответ на «вагон документов» бриджа-предка:
 * ПРОТОКОЛ (порт) закрыт и мал, УДОБСТВА растут здесь — в модуле, не в
 * контракте моста и не в адаптере.
 */

import type { IRegisteredComponent, IStorePort } from '@weber/kernel';
import type { ExpandTags, ITagQueryOptions } from './query';
import { matchByTags, matchEntryByTags, omitByTags, pickByTags } from './query';

export interface IStoreFacade<TCtx = unknown> extends IStorePort<TCtx> {
  pick(tags: readonly string[], opts?: ITagQueryOptions): Record<string, IRegisteredComponent>;
  omit(tags: readonly string[], opts?: ITagQueryOptions): Record<string, IRegisteredComponent>;
  match(tags: readonly string[], opts?: ITagQueryOptions): IRegisteredComponent | undefined;
  matchEntry(
    tags: readonly string[],
    opts?: ITagQueryOptions,
  ): ({ id: string } & IRegisteredComponent) | undefined;
  /**
   * Плоский словарь `{ [name]: value }` по совпавшим компонентам (сбор форм).
   * Компоненты без `name` пропускаются; при дубле name — last write wins
   * (симптом ошибки разработчика, документировано, не throw).
   */
  values(tags: readonly string[], opts?: ITagQueryOptions): Record<string, unknown>;
  /**
   * Tag-based мутатор: находит по тегам (как `pick`) и мержит patch в
   * runtime-props (`setProps`). `patchOrFn` — объект (всем) либо
   * `(comp, id) => patch | null` (per-component; falsy/{} пропускает id).
   * Один `setProps` на все совпадения — атомарный update.
   */
  patch(
    tags: readonly string[],
    patchOrFn:
      | Record<string, unknown>
      | ((comp: IRegisteredComponent, id: string) => Record<string, unknown> | null | undefined),
    opts?: ITagQueryOptions,
  ): void;
}

/**
 * Строит фасад над портом. Делегация — ГЕТТЕРАМИ (не spread): порт реактивен,
 * spread снял бы снапшот и убил реактивность чтения.
 */
export const createStoreFacade = <TCtx = unknown>(
  port: IStorePort<TCtx>,
  expand: ExpandTags,
): IStoreFacade<TCtx> => ({
  // --- делегация порта (реактивные чтения через геттеры) ------------------
  get ctx() {
    return port.ctx;
  },
  get loading() {
    return port.loading;
  },
  get errors() {
    return port.errors;
  },
  get styles() {
    return port.styles;
  },
  get components() {
    return port.components;
  },
  get props() {
    return port.props;
  },
  update: (payload) => port.update(payload),
  setLoading: (value) => port.setLoading(value),
  setStyles: (styles) => port.setStyles(styles),
  setErrors: (errors) => port.setErrors(errors),
  setProps: (payload) => port.setProps(payload),
  registerComponent: (patch) => port.registerComponent(patch),
  unregisterComponent: (id) => port.unregisterComponent(id),
  updateComponent: (patch) => port.updateComponent(patch),

  // --- удобства модуля поверх порта ---------------------------------------
  pick: (tags, opts) => pickByTags(port.components, tags, expand, opts),
  omit: (tags, opts) => omitByTags(port.components, tags, expand, opts),
  match: (tags, opts) => matchByTags(port.components, tags, expand, opts),
  matchEntry: (tags, opts) => matchEntryByTags(port.components, tags, expand, opts),
  values: (tags, opts) => {
    const matched = pickByTags(port.components, tags, expand, opts);
    const result: Record<string, unknown> = {};
    for (const comp of Object.values(matched)) {
      if (comp.name !== undefined && comp.name !== null && comp.name !== '') {
        result[comp.name] = comp.value;
      }
    }
    return result;
  },
  patch: (tags, patchOrFn, opts) => {
    const matched = pickByTags(port.components, tags, expand, opts);
    const payload: Record<string, Record<string, unknown>> = {};
    for (const [id, comp] of Object.entries(matched)) {
      const p = typeof patchOrFn === 'function' ? patchOrFn(comp, id) : patchOrFn;
      if (p && Object.keys(p).length) payload[id] = p;
    }
    if (Object.keys(payload).length) port.setProps(payload);
  },
});
