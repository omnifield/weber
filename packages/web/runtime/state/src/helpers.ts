import { intersection } from 'es-toolkit/array';
import { find } from 'es-toolkit/compat';
import { omitBy, pickBy } from 'es-toolkit/object';
import { expandTags } from './tag-registry';

export interface ComponentData {
  meta?: { tags?: string[] };
  dynamicMeta?: { tags?: string[] };
  [key: string]: any;
}

type ComponentsList = Record<string, ComponentData>;

export interface MatchOptions {
  /** Учитывать ли dynamicMeta.tags при поиске. По умолчанию `true`. */
  lookDynamic?: boolean;
  /** Раскрывать ли алиасы тегов из tag-registry. По умолчанию `true`. */
  expandAliases?: boolean;
}

const hasTags = (
  item: ComponentData,
  targetTags: readonly string[],
  opts: Required<MatchOptions>,
) => {
  const metaTags = item.meta?.tags ?? [];
  const dynamicTags = opts.lookDynamic ? (item.dynamicMeta?.tags ?? []) : [];
  const allItemTags = [...metaTags, ...dynamicTags];

  const query = opts.expandAliases ? expandTags(targetTags) : targetTags;

  return intersection(allItemTags, query as string[]).length > 0;
};

const normalizeOpts = (opts?: MatchOptions): Required<MatchOptions> => ({
  lookDynamic: opts?.lookDynamic ?? true,
  expandAliases: opts?.expandAliases ?? true,
});

/** Оставляет компоненты, у которых есть указанные теги (с учётом алиасов). */
export const pickByTags = (
  data: ComponentsList,
  targetTags: readonly string[],
  opts?: MatchOptions,
) => pickBy(data, (item) => hasTags(item, targetTags, normalizeOpts(opts)));

/** Убирает компоненты, у которых есть указанные теги. */
export const omitByTags = (
  data: ComponentsList,
  targetTags: readonly string[],
  opts?: MatchOptions,
) => omitBy(data, (item) => hasTags(item, targetTags, normalizeOpts(opts)));

/** Первый компонент с указанными тегами. */
export const matchByTags = (
  data: ComponentsList,
  targetTags: readonly string[],
  opts?: MatchOptions,
) => find(Object.values(data), (item) => hasTags(item, targetTags, normalizeOpts(opts)));

/** Первый компонент + его id. */
export const matchEntryByTags = (
  data: ComponentsList,
  targetTags: readonly string[],
  opts?: MatchOptions,
) => {
  const o = normalizeOpts(opts);
  const entry = find(Object.entries(data), ([, item]) => hasTags(item, targetTags, o));
  return entry ? { id: entry[0], ...entry[1] } : undefined;
};
