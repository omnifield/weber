/**
 * @omnifield/shared-zod/gen
 *
 * Генератор данных по Zod-схеме — faker-база + injectable ValueGenerator'ы.
 *
 * Зависимость: @faker-js/faker (bundled в этот entry, НЕ тянется в основной index).
 *
 * ## Решение по реализации
 * Используется свой компактный обход Zod-дерева (через `schema._def`) поверх faker,
 * а не готовая библиотека (@anatine/zod-mock / zocker), потому что:
 *  1. Нужна строгая injectable-архитектура (match/order/GenFieldCtx) — её нет ни в одной готовой либе.
 *  2. Нужен единый seeded faker-инстанс для всего дерева — готовые либы не гарантируют.
 *  3. Zod._def обход — стандартный паттерн (все zod-mock-либы делают то же внутри).
 *  4. Размер кода небольшой (~200 строк), поддерживаем сами.
 *
 * @example
 * import { gen, genList, registerGenerator } from '@omnifield/shared-zod/gen';
 * import { z } from '@omnifield/shared-zod';
 *
 * const UserSchema = z.object({ id: z.string().uuid(), email: z.string().email() });
 *
 * // Одна сущность по схеме:
 * const user = gen(UserSchema, { seed: 42 });
 *
 * // Список (10 элементов):
 * const users = gen(z.array(UserSchema), { seed: 42, count: 10 });
 * // или через хелпер:
 * const users2 = genList(UserSchema, { seed: 42, count: 10 });
 *
 * // Инъекция доменного генератора:
 * const users3 = gen(UserSchema, {
 *   seed: 42,
 *   generators: [{
 *     id: 'custom-email',
 *     match: (ctx) => ctx.fieldName === 'email',
 *     generate: () => 'test@example.com',
 *   }],
 * });
 *
 * // Глобальная регистрация (один раз при инициализации):
 * registerGenerator({
 *   id: 'incident-status',
 *   match: (ctx) => ctx.fieldName === 'status',
 *   generate: (ctx) => ctx.faker.helpers.arrayElement(['open', 'closed', 'pending']),
 * });
 */

export { gen, genList } from './gen';
export { registerGenerator, unregisterGenerator } from './registry';
export type { GenFieldCtx, GenOptions, ValueGenerator } from './types';
