import { faker as fakerBase } from '@faker-js/faker';
import { type ZodTypeAny, z as zod } from 'zod';
import { generateByZodType } from './faker-base';
import { getGlobalGenerators } from './registry';
import type { GenFieldCtx, GenOptions, ValueGenerator } from './types';

/**
 * Сортировка value-generators по order (меньше = выше приоритет).
 * Стабильная: generators с одинаковым order сохраняют порядок регистрации.
 */
const sortByOrder = (gens: ValueGenerator[]): ValueGenerator[] =>
  [...gens].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

/**
 * Sentinel — означает «не совпало ни одного generator'а».
 */
const MISS = Symbol('miss');

const resolveWithGenerators = (
  generators: ValueGenerator[],
  ctx: GenFieldCtx,
): unknown | typeof MISS => {
  for (const gen of generators) {
    if (gen.match(ctx)) {
      return gen.generate(ctx);
    }
  }
  return MISS;
};

/**
 * Создаёт фиксированную дату-якорь на основе seed для детерминизма.
 * Все date-генераторы используют её как refDate — Date.now() не задействован.
 *
 * Формула: seed-based UNIX timestamp в диапазоне 2020-2025.
 */
const makeRefDate = (seed: number): Date => {
  // Диапазон: 2020-01-01 (1577836800000ms) + seed-based offset (до ~5 лет в мс)
  const BASE = 1577836800000;
  const RANGE = 157_680_000_000; // 5 лет в мс
  return new Date(BASE + ((seed * 1_000_003) % RANGE));
};

// ---------------------------------------------------------------------------
// Единый внутренний движок
// ---------------------------------------------------------------------------

/**
 * Строит рекурсивный обходчик схемы для заданного seed и набора generators.
 * Вызывается один раз на каждый вызов `gen` / `genList`.
 *
 * Возвращает функцию `recurse`, готовую к использованию.
 */
const buildRecurse = (
  seed: number,
  allGens: ValueGenerator[],
  refDate: Date,
): ((currentSchema: ZodTypeAny, fieldName?: string, currentPath?: string[]) => unknown) => {
  const recurse = (
    currentSchema: ZodTypeAny,
    fieldName = '',
    currentPath: string[] = [],
  ): unknown => {
    const path = fieldName ? [...currentPath, fieldName] : currentPath;

    const ctx: GenFieldCtx = {
      schema: currentSchema,
      fieldName,
      path,
      faker: fakerBase,
      seed,
      recurse: (s, name = '') => recurse(s, name, path),
    };

    // 1. Injectable generators (local + global)
    if (allGens.length > 0) {
      const result = resolveWithGenerators(allGens, ctx);
      if (result !== MISS) return result;
    }

    // 2. Faker-база
    return generateByZodType(currentSchema, {
      ...ctx,
      recurse: (s: ZodTypeAny, name = '') => recurse(s, name, path),
      refDate,
    });
  };

  return recurse;
};

// ---------------------------------------------------------------------------
// Публичный API
// ---------------------------------------------------------------------------

/**
 * Генерирует одно валидное значение по Zod-схеме.
 *
 * @param schema — любая Zod-схема (z.object, z.string, z.array, ...)
 * @param options — seed, count (для массивов), generators
 * @returns валидное значение типа `z.infer<typeof schema>`
 *
 * @example
 * const user = gen(UserSchema, { seed: 42 });
 * const users = gen(z.array(UserSchema), { seed: 42, count: 10 });
 */
export const gen = <T extends ZodTypeAny>(
  schema: T,
  options: GenOptions = {},
): ReturnType<T['parse']> => {
  const { seed = 1, count = 3, generators: localGens = [] } = options;

  const allGens = sortByOrder([...localGens, ...getGlobalGenerators()]);
  const refDate = makeRefDate(seed);

  // Определяем, является ли это массивом верхнего уровня — учитываем `count`
  const def = schema._def as Record<string, unknown>;
  if (def.typeName === 'ZodArray') {
    const innerType = def.type as ZodTypeAny;
    // Сбрасываем seed непосредственно перед генерацией массива
    fakerBase.seed(seed);
    const recurse = buildRecurse(seed, allGens, refDate);
    return Array.from({ length: count }, (_, i) => recurse(innerType, `[${i}]`, [])) as ReturnType<
      T['parse']
    >;
  }

  // Seeded faker-инстанс — один на всё дерево для детерминизма
  fakerBase.seed(seed);
  const recurse = buildRecurse(seed, allGens, refDate);
  return recurse(schema, '', []) as ReturnType<T['parse']>;
};

/**
 * Удобный хелпер для генерации списка: принимает схему элемента (не ZodArray).
 * Делегирует в `gen(z.array(itemSchema), options)` — единственный источник правды
 * для массивного пути.
 *
 * @example
 * const users = genList(UserSchema, { seed: 42, count: 5 });
 * // users: User[]
 */
export const genList = <T extends ZodTypeAny>(
  itemSchema: T,
  options: GenOptions = {},
): Array<ReturnType<T['parse']>> => {
  // ZodArray-путь в `gen` — единственный источник правды для массивного обхода.
  // seed сбрасывается прямо перед Array.from, generators передаются насквозь.
  return gen(zod.array(itemSchema), options) as Array<ReturnType<T['parse']>>;
};
