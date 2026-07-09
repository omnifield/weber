import type { Faker } from '@faker-js/faker';
import type { ZodTypeAny } from 'zod';

/**
 * Контекст, передаваемый в value-generator и в faker-базу при обходе поля схемы.
 */
export interface GenFieldCtx {
  /** Zod-объект схемы данного поля. */
  schema: ZodTypeAny;
  /** Имя поля (leaf) — например `"email"`, `"firstName"`. Пустая строка для корня. */
  fieldName: string;
  /** Полный путь от корня объекта — например `["user", "email"]`. */
  path: string[];
  /** Seeded faker-инстанс (переиспользуется для всего дерева, не пересоздавать). */
  faker: Faker;
  /** Числовой seed, переданный в gen(). */
  seed: number;
  /** Рекурсивный генератор для вложенных схем (использовать внутри generate()). */
  recurse: (schema: ZodTypeAny, fieldName?: string) => unknown;
}

/**
 * Кастомный генератор значений, инжектируемый через `gen(schema, { generators })`.
 * Паттерн ADR 037 SubGenerator.
 */
export interface ValueGenerator {
  /** Уникальный идентификатор (для отладки / дедупликации). */
  id: string;
  /**
   * Возвращает true, если этот генератор берётся для данного поля.
   * Вызывается в порядке `order` (меньше = приоритетнее).
   */
  match(ctx: GenFieldCtx): boolean;
  /**
   * Генерирует значение для поля. Вызывается только если `match` вернул true.
   */
  generate(ctx: GenFieldCtx): unknown;
  /**
   * Порядок резолва: меньшее число = более высокий приоритет.
   * По умолчанию 0. Faker-база имеет неявный приоритет ∞ (фолбэк).
   */
  order?: number;
}

/**
 * Параметры вызова gen().
 */
export interface GenOptions {
  /**
   * Числовой seed для детерминированной генерации.
   * Один seed → один и тот же результат.
   * @default 1
   */
  seed?: number;
  /**
   * Кол-во элементов при генерации массива (`z.array(...)`).
   * Если схема — не ZodArray, параметр игнорируется.
   * @default 3
   */
  count?: number;
  /**
   * Список инжектируемых генераторов. Резолвятся ДО faker-базы.
   * Первый, чей `match()` вернул true, побеждает.
   */
  generators?: ValueGenerator[];
}
