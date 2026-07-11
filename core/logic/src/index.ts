import { defineModule } from '@weber/kernel';
import type { ILogicApi, ILogicModuleConfig } from './logic-wrapper';
import { createLogic } from './logic-wrapper';

export type { IControllerProxyParams } from './controller-proxy';
export { ControllerProxy } from './controller-proxy';
export { createEmit, normalizeTarget, useEmit, useEmitOptional } from './emit';
export type {
  EmitFn,
  Handler,
  IHandlerApi,
  ILogicSchemaFull,
  ILogicWrapperProps,
  INext,
  IServices,
  LogicKind,
} from './interfaces';
export type { ILogicApi, ILogicModuleConfig, SchemaFactory } from './logic-wrapper';
export { createLogic } from './logic-wrapper';
export type { ExpandTags, ITagQueryOptions } from './query';
export {
  createTagRegistry,
  DEFAULT_ALIASES,
  matchByTags,
  matchEntryByTags,
  omitByTags,
  pickByTags,
} from './query';
export type { IStoreFacade } from './store-facade';
export { createStoreFacade } from './store-facade';

/** Дескриптор модуля кора (ADR-0001): вход = ILogicModuleConfig, выход = ILogicApi. */
export const logicModule = defineModule<ILogicApi, ILogicModuleConfig>({
  name: 'weber:logic',
  create: (config) => {
    if (!config) throw new Error('[weber:logic] config with a state adapter is required');
    return createLogic(config);
  },
});
