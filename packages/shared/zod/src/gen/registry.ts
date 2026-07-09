import type { ValueGenerator } from './types';

/**
 * Глобальный реестр value-generators.
 * Используется через `registerGenerator()` для app-уровневых доменных генераторов,
 * которые должны быть активны для всех вызовов gen() без явной передачи в options.
 *
 * Порядок резолва при вызове gen():
 *   1. generators из GenOptions (локальные, переданные на конкретный вызов)
 *   2. глобально зарегистрированные (этот реестр)
 *   3. faker-база (фолбэк)
 */
const globalRegistry: ValueGenerator[] = [];

/**
 * Регистрирует value-generator глобально.
 * Вызывается один раз при инициализации приложения.
 *
 * @example
 * registerGenerator({
 *   id: 'incident-status',
 *   match: (ctx) => ctx.fieldName === 'status' && ctx.path[0] === 'incident',
 *   generate: (ctx) => ctx.faker.helpers.arrayElement(['open', 'closed', 'pending']),
 *   order: -10, // выше стандартного 0
 * });
 */
export const registerGenerator = (gen: ValueGenerator): void => {
  // Дедупликация по id
  const existing = globalRegistry.findIndex((g) => g.id === gen.id);
  if (existing !== -1) {
    globalRegistry[existing] = gen;
  } else {
    globalRegistry.push(gen);
  }
};

/**
 * Удаляет ранее зарегистрированный generator.
 * Полезно в тестах для изоляции.
 */
export const unregisterGenerator = (id: string): void => {
  const idx = globalRegistry.findIndex((g) => g.id === id);
  if (idx !== -1) globalRegistry.splice(idx, 1);
};

/**
 * Возвращает копию текущего глобального реестра.
 * Используется внутри gen() для слияния с локальными generators.
 */
export const getGlobalGenerators = (): ValueGenerator[] => [...globalRegistry];
