/**
 * Entity — domain data layer factory (plain config, не компонент; порт
 * капсульного entity/wrapper.ts). Отличие от предка: инструменты (`zod` и др.)
 * НЕ вшиты shared-zod-шимом — приходят из конфига сборки (`tools`), кор
 * остаётся без зависимости на zod (сборка аппа приносит свой).
 *
 * Семантика: фабрика зовётся на module-load с tools; возвращает ЗАМОРОЖЕННЫЙ
 * plain config `{ schema, defaults?, ... }`. Никакого Solid/runtime.
 */

export type IEntityTools = Record<string, unknown>;

export interface IEntityDefinition {
  schema?: unknown;
  defaults?: unknown;
  [k: string]: unknown;
}

export type EntityFactory<T extends IEntityDefinition> = (tools: IEntityTools) => T;

export const createEntityWrapper =
  (tools: IEntityTools) =>
  <T extends IEntityDefinition>(factory: EntityFactory<T>): Readonly<T> =>
    Object.freeze(factory(tools));
