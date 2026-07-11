/**
 * Сборка движка (ADR-0001 §сборка — появилась вместе с обёртками, не раньше).
 *
 * `createWeberEngine(config)` — composition root кора: инстанцирует модули
 * (ui-proxy, logic), делает межмодульные связки (compositeWrap → bindEvents),
 * строит обёртки слоёв и пер-engine реестр. Один апп = один engine; никакого
 * глобального состояния (решение user: без globalThis, без переходных шимов).
 */

import type { IStateAdapter } from '@weber/kernel';
import type { ILogicApi, ILogicWrapperProps, LogicKind, SchemaFactory } from '@weber/logic';
import { createLogic } from '@weber/logic';
import type { IUiProxyApi, IUiProxyConventions } from '@weber/ui-proxy';
import { createUiProxy } from '@weber/ui-proxy';
import type { EntityFactory, IEntityDefinition, IEntityTools } from './entity';
import { createEntityWrapper } from './entity';
import type { IRegistryApi, IRegistryPatch } from './registry';
import { createRegistry } from './registry';
import { createShapeWrapper } from './shape/wrapper';
import type { IWidgetOptions, Kit, TraceFn } from './wrappers';
import { createWrappers } from './wrappers';

export interface IWeberEngineConfig {
  /** Любой UI-kit (дерево компонентов). Outlet/router-примитивы — состав кита при сборке аппа. */
  kit: Kit;
  /** State-начинка порта (дефолт экосистемы — createSolidStateAdapter из @weber/state). */
  adapter: IStateAdapter;
  /** Инструменты data-слоя (Entity/Shape фабрики): `{ zod, ... }` — приносит сборка аппа. */
  tools?: IEntityTools;
  /** Состав services для фабрик Controller/Feature (router/api/…) — за сборкой. */
  services?: (kind: LogicKind) => Record<string, unknown>;
  /** Слоты (обычно — сгенерённый build-infra модуль реестра). */
  registry?: IRegistryPatch;
  /** Конвенции ui-proxy поверх дефолтов (kindTags/events/… — привозит кит). */
  uiProxy?: Partial<IUiProxyConventions>;
  /** Tag-алиасы поверх дефолтов. */
  aliases?: Record<string, readonly string[]>;
  /** Observability-слот (mount/dispose всех слоёв + logic). */
  trace?: TraceFn;
}

export interface IWeberEngine {
  // --- обёртки слоёв (публичное лицо движка) ---
  Entity: <T extends IEntityDefinition>(factory: EntityFactory<T>) => Readonly<T>;
  View: ReturnType<typeof createWrappers>['View'];
  Shape: ReturnType<typeof createShapeWrapper>;
  Widget: ReturnType<typeof createWrappers>['Widget'];
  Page: ReturnType<typeof createWrappers>['Page'];
  Controller: (factory: SchemaFactory) => (props: ILogicWrapperProps) => any;
  Feature: (factory: SchemaFactory) => (props: ILogicWrapperProps) => any;
  // --- реестр и модули ---
  registry: IRegistryApi['registry'];
  register: IRegistryApi['register'];
  /** Инстансы модулей — для продвинутых потребителей/тестов. */
  modules: { uiProxy: IUiProxyApi; logic: ILogicApi };
}

export const createWeberEngine = (config: IWeberEngineConfig): IWeberEngine => {
  const uiProxy = createUiProxy(config.uiProxy);

  // Межмодульная связка на сборке: composite-строки китов получают
  // event-binding ui-proxy, прямого dep между модулями нет.
  const logic = createLogic({
    adapter: config.adapter,
    services: config.services,
    aliases: config.aliases,
    trace: config.trace,
    compositeWrap: (ctx) => (Comp) => uiProxy.bindEvents(ctx, Comp as any) as any,
  });

  const { registry, register } = createRegistry(config.registry);

  const wrappers = createWrappers({ kit: config.kit, uiProxy, trace: config.trace });
  const tools = config.tools ?? {};

  return {
    Entity: createEntityWrapper(tools),
    View: wrappers.View,
    Shape: createShapeWrapper({ tools, trace: config.trace }),
    Widget: wrappers.Widget,
    Page: wrappers.Page,
    Controller: logic.createController,
    Feature: logic.createFeature,
    registry,
    register,
    modules: { uiProxy, logic },
  };
};

export type { IWidgetOptions, Kit, TraceFn };
