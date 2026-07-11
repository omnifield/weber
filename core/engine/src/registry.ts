/**
 * Реестр слотов — ПЕР-ENGINE (решение user 2026-07-12: с globalThis уходим
 * сразу, без переходных шимов; предок сам планировал этот уход — A-2/A-3
 * его cleanup-plan).
 *
 * Доставка «без импортов» в код аппа — слой build-infra (ADR-0002): кодген
 * генерит НАСТОЯЩИЙ модуль реестра (real re-exports → навигация IDE), апп
 * скармливает его сюда на бутстрапе. Никакого глобального мутабельного
 * состояния: два движка на странице (микрофронты, тест-зоны модулей) не
 * делят ничего.
 */

export interface IRegistry {
  /** UI JSX-leaf слои. */
  Views: Record<string, unknown>;
  Widgets: Record<string, unknown>;
  /** Domain data layer (plain configs). */
  Entities: Record<string, unknown>;
  Controllers: Record<string, unknown>;
  Features: Record<string, unknown>;
  Shapes: Record<string, unknown>;
}

export type IRegistryPatch = { [K in keyof IRegistry]?: IRegistry[K] };

const EMPTY = (): IRegistry => ({
  Views: {},
  Widgets: {},
  Entities: {},
  Controllers: {},
  Features: {},
  Shapes: {},
});

export interface IRegistryApi {
  readonly registry: Readonly<IRegistry>;
  /** Merge поверх текущего: per-namespace shallow (кодген приносит целиком). */
  register(patch: IRegistryPatch): void;
}

export const createRegistry = (initial?: IRegistryPatch): IRegistryApi => {
  const registry = EMPTY();
  const register = (patch: IRegistryPatch): void => {
    for (const key of Object.keys(patch) as (keyof IRegistry)[]) {
      Object.assign(registry[key], patch[key]);
    }
  };
  if (initial) register(initial);
  return { registry, register };
};
