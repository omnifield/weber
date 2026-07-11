import { defineModule } from '@weber/kernel';
import type { IWeberEngine, IWeberEngineConfig } from './engine';
import { createWeberEngine } from './engine';

export type { ICreateRootOptions } from './create-root';
export { createRoot } from './create-root';
export type { IWeberEngine, IWeberEngineConfig } from './engine';
export { createWeberEngine } from './engine';
export type { EntityFactory, IEntityDefinition, IEntityTools } from './entity';
export type { IRegistry, IRegistryApi, IRegistryPatch } from './registry';
export { createRegistry } from './registry';
export type { IShapeUiNamespace } from './shape/context';
export { ShapeUiContext, useShapeUi } from './shape/context';
export {
  createUiTracker,
  getTrackerPath,
  resolveByPath,
  resolveValue,
  resolveValuesInObject,
} from './shape/ui-tracker';
export type { IWidgetOptions, Kit, TraceFn } from './wrappers';

/** Дескриптор модуля-сборки (ADR-0001): вход = конфиг движка, выход = движок. */
export const engineModule = defineModule<IWeberEngine, IWeberEngineConfig>({
  name: 'weber:engine',
  create: (config) => {
    if (!config) throw new Error('[weber:engine] config (kit + adapter) is required');
    return createWeberEngine(config);
  },
});
