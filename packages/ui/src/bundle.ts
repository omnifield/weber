/**
 * IKitBundle — КОНТРАКТ КИТА для сборки (решение user 2026-07-12): кит
 * экспортирует себя одним типизированным свёртком, сборка аппа мержит
 * НЕСКОЛЬКО bundle'ов в один kit (наш + боковые пакеты + юзерские) —
 * это конструктивное решение augmentation-модели (fork-flag #10 предка):
 * никакой магии namespace-аугментации, просто ещё один bundle в merge.
 */

import type { IComponentManifest } from './manifest/types';

export interface IKitConventions {
  /** Whitelist «имя примитива → kind-tag» для ui-proxy (движок мержит поверх дефолтов). */
  kindTags?: Record<string, string>;
  /** Ключи, отдаваемые из прокси как есть (control-flow, иконки, порталы). */
  rawPassthroughKeys?: readonly string[];
}

export interface IKitBundle {
  /** Дерево компонентов — то, что ест `createWeberEngine({ kit })`. */
  components: Record<string, unknown>;
  /** Конвенции ui-proxy, которые привозит этот кит. */
  conventions?: IKitConventions;
  /** Манифесты компонентов (студио/рендерер читают ЛЮБОЙ набор этого shape). */
  manifests?: readonly IComponentManifest[];
}

/** Merge нескольких bundle'ов (правый выигрывает по коллизиям компонентов). */
export const mergeKitBundles = (...bundles: IKitBundle[]): IKitBundle => {
  const components: Record<string, unknown> = {};
  const kindTags: Record<string, string> = {};
  const rawKeys = new Set<string>();
  const manifests: IComponentManifest[] = [];
  for (const b of bundles) {
    Object.assign(components, b.components);
    Object.assign(kindTags, b.conventions?.kindTags ?? {});
    for (const k of b.conventions?.rawPassthroughKeys ?? []) rawKeys.add(k);
    manifests.push(...(b.manifests ?? []));
  }
  return {
    components,
    conventions: { kindTags, rawPassthroughKeys: [...rawKeys] },
    manifests,
  };
};
