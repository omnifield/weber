/**
 * Канон «без импортов» = слой ДОСТАВКИ (ADR-0002): unimport-глобалы поверх
 * НАСТОЯЩИХ модулей — обёртки слоёв из engine-модуля аппа, реестры из
 * сгенерённых барелей, хуки из пакетов кора. Навигация (Ctrl+Click) и типы —
 * честные, из источников; d.ts генерит unplugin атомарно (боль №3 предка).
 */

export interface IAutoImportsOptions {
  /** Спецификатор модуля обёрток (дефолт — алиас `@weber-app/engine` → src/engine). */
  engineModule?: string;
  /** Спецификатор реестра (дефолт — алиас `@weber-app/registry` → .weber/registry). */
  registryModule?: string;
}

/** Алиасы аппа: unimport вставляет `from` как есть — относительные пути ломаются. */
export const APP_ENGINE_ALIAS = '@weber-app/engine';
export const APP_REGISTRY_ALIAS = '@weber-app/registry';

export const WRAPPER_NAMES = [
  'Entity',
  'View',
  'Shape',
  'Widget',
  'Page',
  'Controller',
  'Feature',
] as const;

export const REGISTRY_NAMES = [
  'Views',
  'Widgets',
  'Entities',
  'Controllers',
  'Features',
  'Shapes',
] as const;

/** imports-секция для unplugin-auto-import. */
export const buildAutoImports = (options: IAutoImportsOptions = {}) => {
  const engineModule = options.engineModule ?? APP_ENGINE_ALIAS;
  const registryModule = options.registryModule ?? APP_REGISTRY_ALIAS;

  return [
    { [engineModule]: WRAPPER_NAMES.slice() },
    { [registryModule]: REGISTRY_NAMES.slice() },
    { '@weber/kernel': ['useCtx', 'useCompositeWrap'] },
    { '@weber/logic': ['useEmit', 'useEmitOptional'] },
  ];
};
