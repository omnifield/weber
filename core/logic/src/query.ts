/**
 * Tag-запросы по реестру компонентов + реестр алиасов (порт web-state
 * helpers.ts/tag-registry.ts предка, fix-then-transfer):
 *  - без es-toolkit (4 однострочника не стоят зависимости в коре);
 *  - реестр алиасов ПЕР-ИНСТАНСНЫЙ (module-global state в модулях запрещён,
 *    ADR-0001) — живёт в замыкании logic-инстанса.
 */

import type { IRegisteredComponent } from '@weber/kernel';

export interface ITagQueryOptions {
  /** Учитывать ли dynamicMeta.tags. По умолчанию true. */
  lookDynamic?: boolean;
  /** Раскрывать ли алиасы тегов. По умолчанию true. */
  expandAliases?: boolean;
}

export type ExpandTags = (tags: readonly string[]) => string[];

type Components = Record<string, IRegisteredComponent>;

/** Дефолтные алиасы (капсульный набор) — merge поверх при config.aliases. */
export const DEFAULT_ALIASES: Record<string, readonly string[]> = {
  '@inputs': ['email', 'password', 'phone', 'text', 'number'],
  '@actions': ['submit', 'cancel', 'reset'],
};

/**
 * Пер-инстансный реестр алиасов. Алиас — «зонтик»: запрос `pick(['@inputs'])`
 * находит и сам `@inputs`, и все его раскрытия (рекурсивно, с защитой от циклов).
 */
export const createTagRegistry = (initial?: Record<string, readonly string[]>) => {
  let aliases: Record<string, readonly string[]> = { ...DEFAULT_ALIASES, ...initial };

  const expand: ExpandTags = (tags) => {
    const out = new Set<string>();
    const queue: string[] = [...tags];
    const seen = new Set<string>();
    while (queue.length > 0) {
      const tag = queue.shift() as string;
      if (seen.has(tag)) continue;
      seen.add(tag);
      out.add(tag);
      const expansion = aliases[tag];
      if (expansion) {
        for (const t of expansion) {
          if (!seen.has(t)) queue.push(t);
        }
      }
    }
    return [...out];
  };

  return {
    /** Слить алиасы с реестром (override по совпадающим ключам). */
    register: (next: Record<string, readonly string[]>): void => {
      aliases = { ...aliases, ...next };
    },
    /** Полностью очистить (включая дефолты). */
    clear: (): void => {
      aliases = {};
    },
    snapshot: (): Readonly<Record<string, readonly string[]>> => aliases,
    expand,
  };
};

const normalizeOpts = (opts?: ITagQueryOptions): Required<ITagQueryOptions> => ({
  lookDynamic: opts?.lookDynamic ?? true,
  expandAliases: opts?.expandAliases ?? true,
});

const hasTags = (
  item: IRegisteredComponent,
  targetTags: readonly string[],
  opts: Required<ITagQueryOptions>,
  expand: ExpandTags,
): boolean => {
  const metaTags = item.meta?.tags ?? [];
  const dynamicTags = opts.lookDynamic ? (item.dynamicMeta?.tags ?? []) : [];
  const query = opts.expandAliases ? expand(targetTags) : targetTags;
  const set = new Set(query);
  for (const t of metaTags) if (set.has(t)) return true;
  for (const t of dynamicTags) if (set.has(t)) return true;
  return false;
};

/** Компоненты, у которых есть указанные теги (с учётом алиасов). */
export const pickByTags = (
  data: Components,
  tags: readonly string[],
  expand: ExpandTags,
  opts?: ITagQueryOptions,
): Components => {
  const o = normalizeOpts(opts);
  const out: Components = {};
  for (const [id, item] of Object.entries(data)) {
    if (hasTags(item, tags, o, expand)) out[id] = item;
  }
  return out;
};

/** Компоненты БЕЗ указанных тегов. */
export const omitByTags = (
  data: Components,
  tags: readonly string[],
  expand: ExpandTags,
  opts?: ITagQueryOptions,
): Components => {
  const o = normalizeOpts(opts);
  const out: Components = {};
  for (const [id, item] of Object.entries(data)) {
    if (!hasTags(item, tags, o, expand)) out[id] = item;
  }
  return out;
};

/** Первый компонент с указанными тегами. */
export const matchByTags = (
  data: Components,
  tags: readonly string[],
  expand: ExpandTags,
  opts?: ITagQueryOptions,
): IRegisteredComponent | undefined => {
  const o = normalizeOpts(opts);
  for (const item of Object.values(data)) {
    if (hasTags(item, tags, o, expand)) return item;
  }
  return undefined;
};

/** Первый компонент + его id. */
export const matchEntryByTags = (
  data: Components,
  tags: readonly string[],
  expand: ExpandTags,
  opts?: ITagQueryOptions,
): ({ id: string } & IRegisteredComponent) | undefined => {
  const o = normalizeOpts(opts);
  for (const [id, item] of Object.entries(data)) {
    if (hasTags(item, tags, o, expand)) return { id, ...item };
  }
  return undefined;
};
