import { defineModule } from '@weber/kernel';
import type { IUiProxyConventions } from './conventions';
import type { IUiProxyApi } from './ui-proxy';
import { createUiProxy } from './ui-proxy';

export type { AccessResolver } from './access';
export { hasAccessResolver, registerAccessResolver, resolveAccess } from './access';
export type { IEventConvention, IUiProxyConventions } from './conventions';
export { DEFAULT_CONVENTIONS, resolveConventions } from './conventions';
export type { AnyEvent } from './derivation';
export { deriveInputType, deriveName, getTargetData } from './derivation';
export type { IUiProxyApi } from './ui-proxy';
export { createUiProxy } from './ui-proxy';

/** Дескриптор модуля кора (ADR-0001): вход = конвенции, выход = IUiProxyApi. */
export const uiProxyModule = defineModule<IUiProxyApi, Partial<IUiProxyConventions>>({
  name: 'weber:ui-proxy',
  create: (config) => createUiProxy(config),
});
