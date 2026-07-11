/**
 * Shape wrapper — двухфазная форма (порт капсульного shape/wrapper.tsx,
 * ADR 036 предка):
 *
 * ```ts
 * Shape(
 *   (ui, { zod }) => ({ schema, as }),      // BIND (module-load): данные + шаблон
 *   (ui, props) => ({ item, ...config }),   // CONFIG (per-render): объект ИЛИ функция
 * )
 * ```
 *
 * `ui` в обеих фазах — path-tracker (реального Ui нет на module-load);
 * резолв lazy на рендере по ShapeUiContext. Отличия от предка: tools
 * (zod) — из конфига сборки; trace — слот; access — из ui-proxy модуля
 * (прямая модуль-интеграция).
 */

import { hasAccessResolver, resolveAccess } from '@weber/ui-proxy';
import { createUniqueId, mergeProps, onCleanup, splitProps } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { TraceFn } from '../wrappers';
import { useShapeUi } from './context';
import {
  createUiTracker,
  getTrackerPath,
  resolveByPath,
  resolveValuesInObject,
} from './ui-tracker';

export interface IShapeEnv {
  tools: Record<string, unknown>;
  trace?: TraceFn;
}

export interface IShapeConsumerProps {
  as?: unknown;
  data?: unknown;
  [k: string]: unknown;
}

type BindFn = (ui: unknown, tools: Record<string, unknown>) => Record<string, unknown>;
type ConfigArg =
  | Record<string, unknown>
  | ((ui: unknown, props: IShapeConsumerProps) => Record<string, unknown>);

export const createShapeWrapper = (env: IShapeEnv) => {
  return (bind: BindFn, config?: ConfigArg) => {
    // Bind — на module-load; ui — path-tracker.
    const bindUiTracker = createUiTracker();
    const bindResult = bind(bindUiTracker, env.tools) ?? {};
    const { schema: _schema, as: defaultAs, defaults: bindDefaults, ...bindExtras } = bindResult;

    return (consumerProps: IShapeConsumerProps) => {
      const traceId = createUniqueId();
      env.trace?.('weber.shape', 'mount', { id: traceId });
      onCleanup(() => env.trace?.('weber.shape', 'dispose', { id: traceId }));

      const realUi = useShapeUi();

      // --- Резолв template: consumer `as` > bind `as` (tracker → realUi) ---
      const resolveTemplate = (): unknown => {
        if (consumerProps.as) return consumerProps.as;
        if (!defaultAs) return undefined;
        const path = getTrackerPath(defaultAs);
        if (path && realUi) return resolveByPath(realUi, path);
        return defaultAs;
      };

      const Template = resolveTemplate();
      if (!Template) return null;

      const [ownProps, rest] = splitProps(consumerProps as Record<string, unknown>, ['as', 'data']);

      const getRawConfig = (): Record<string, unknown> => {
        if (typeof config === 'function') {
          return config(bindUiTracker, consumerProps) ?? {};
        }
        return config != null ? config : {};
      };

      // Config как source для mergeProps (функция → Solid обернёт в createMemo,
      // сигналы внутри config-функции трекаются).
      const configSource = (): Record<string, unknown> => {
        const raw = getRawConfig();
        const { defaults: _d, item: _i, ...extras } = raw;
        return extras;
      };

      // bindExtras — static, резолв один раз.
      const resolvedBindExtras = resolveValuesInObject(
        bindExtras as Record<string, unknown>,
        realUi,
      );

      // item (batch-дескриптор): use → компонент элемента, props(it) → маппер
      // row→props; оба резолвятся (trackers → realUi), реактивно из config.
      const getResolvedItem = (): Record<string, unknown> | undefined => {
        const raw = getRawConfig();
        const configItem = raw.item as
          | { use?: unknown; props?: (it: unknown) => unknown }
          | undefined;
        if (!configItem) return undefined;

        const resolvedItemUse =
          configItem.use != null
            ? (() => {
                const path = getTrackerPath(configItem.use);
                if (path && realUi) return resolveByPath(realUi, path);
                return configItem.use;
              })()
            : undefined;

        const resolvedItemProps =
          configItem.props != null
            ? (() => {
                const fn = configItem.props as (it: unknown) => unknown;
                return (it: unknown) => {
                  const result = fn(it);
                  return result !== null && typeof result === 'object' && !Array.isArray(result)
                    ? resolveValuesInObject(result as Record<string, unknown>, realUi)
                    : result;
                };
              })()
            : undefined;

        return { item: { use: resolvedItemUse, props: resolvedItemProps } };
      };

      const hasConsumerData = 'data' in (consumerProps as Record<string, unknown>);

      // Приоритет: bindExtras < config < item < consumer rest.
      const mergedExtras = mergeProps(
        resolvedBindExtras,
        configSource,
        () => getResolvedItem() ?? {},
        rest,
      );

      // data: consumer > config.defaults > bind.defaults; access-gated batch
      // filter (enforcement point A предка) — реактивно в render-скоупе.
      const getData = () => {
        const raw = hasConsumerData
          ? ownProps.data
          : (() => {
              const cfg = getRawConfig();
              return 'defaults' in cfg ? cfg.defaults : bindDefaults;
            })();

        if (!hasAccessResolver() || !Array.isArray(raw)) return raw;

        return raw.filter((item: unknown) => {
          if (item !== null && typeof item === 'object') {
            const cap = (item as Record<string, unknown>).can as string | undefined;
            if (cap) return resolveAccess(cap);
          }
          return true;
        });
      };

      return (
        <Dynamic
          component={Template as Parameters<typeof Dynamic>[0]['component']}
          data={getData()}
          {...(mergedExtras as Record<string, unknown>)}
        />
      );
    };
  };
};
