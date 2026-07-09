import type { Faker } from '@faker-js/faker';
import type { ZodTypeAny } from 'zod';
import type { GenFieldCtx } from './types';

/**
 * Маппинг имени поля (lowercase) → faker-генератор.
 * Расширяемый набор — покрывает типичные доменные поля.
 * Дата-генераторы принимают refDate для детерминизма.
 */
const FIELD_NAME_MAP: Record<string, (faker: Faker, refDate: Date) => unknown> = {
  // person
  firstname: (f) => f.person.firstName(),
  lastname: (f) => f.person.lastName(),
  name: (f) => f.person.fullName(),
  fullname: (f) => f.person.fullName(),
  username: (f) => f.internet.username(),
  // contact
  email: (f) => f.internet.email(),
  phone: (f) => f.phone.number(),
  phonenumber: (f) => f.phone.number(),
  mobile: (f) => f.phone.number(),
  // web
  url: (f) => f.internet.url(),
  website: (f) => f.internet.url(),
  avatar: (f) => f.image.avatar(),
  image: (f) => f.image.url(),
  photo: (f) => f.image.url(),
  // location
  city: (f) => f.location.city(),
  country: (f) => f.location.country(),
  address: (f) => f.location.streetAddress(),
  street: (f) => f.location.street(),
  zip: (f) => f.location.zipCode(),
  zipcode: (f) => f.location.zipCode(),
  latitude: (f) => f.location.latitude(),
  longitude: (f) => f.location.longitude(),
  // commerce / finance
  price: (f) => Number(f.commerce.price()),
  amount: (f) => Number(f.commerce.price()),
  currency: (f) => f.finance.currencyCode(),
  // id / uuid
  id: (f) => f.string.uuid(),
  uuid: (f) => f.string.uuid(),
  // dates — используем refDate для детерминизма
  date: (f, ref) => f.date.recent({ refDate: ref }).toISOString(),
  createdat: (f, ref) => f.date.past({ refDate: ref }).toISOString(),
  updatedat: (f, ref) => f.date.recent({ refDate: ref }).toISOString(),
  deletedat: (f, ref) => f.date.future({ refDate: ref }).toISOString(),
  // text
  title: (f) => f.lorem.sentence(3),
  description: (f) => f.lorem.paragraph(),
  content: (f) => f.lorem.paragraphs(2),
  text: (f) => f.lorem.paragraph(),
  comment: (f) => f.lorem.sentence(),
  message: (f) => f.lorem.sentence(),
  note: (f) => f.lorem.sentence(),
  bio: (f) => f.lorem.paragraph(),
  slug: (f) => f.helpers.slugify(f.lorem.words(3)),
  // misc
  color: (f) => f.color.human(),
  hex: (f) => f.color.rgb({ format: 'hex' }),
  token: (f) => f.string.alphanumeric(32),
  password: (f) => f.internet.password(),
  role: (f) => f.helpers.arrayElement(['admin', 'user', 'moderator', 'guest']),
  status: (f) => f.helpers.arrayElement(['active', 'inactive', 'pending']),
  type: (f) => f.helpers.arrayElement(['type_a', 'type_b', 'type_c']),
  tag: (f) => f.lorem.word(),
  label: (f) => f.lorem.words(2),
  key: (f) => f.string.alphanumeric(16),
  code: (f) => f.string.alphanumeric(8).toUpperCase(),
  number: (f) => f.number.int({ min: 1, max: 9999 }),
  count: (f) => f.number.int({ min: 0, max: 100 }),
  index: (f) => f.number.int({ min: 0, max: 999 }),
  order: (f) => f.number.int({ min: 1, max: 100 }),
  version: (f) =>
    `${f.number.int({ min: 0, max: 9 })}.${f.number.int({ min: 0, max: 9 })}.${f.number.int({ min: 0, max: 99 })}`,
  lang: (f) => f.helpers.arrayElement(['en', 'ru', 'de', 'fr', 'es']),
  locale: (f) => f.helpers.arrayElement(['en-US', 'ru-RU', 'de-DE', 'fr-FR']),
};

/**
 * Нормализуем имя поля: убираем нижние черты, дефисы, приводим к lowercase
 * для более широкого поиска в таблице.
 */
const normalizeFieldName = (name: string): string => name.toLowerCase().replace(/[_\-\s]/g, '');

/**
 * Fallback по имени поля из FIELD_NAME_MAP.
 * Возвращает null если ничего не нашли.
 */
export const generateByFieldName = (
  fieldName: string,
  faker: Faker,
  refDate: Date,
): unknown | null => {
  const key = normalizeFieldName(fieldName);
  const fn = FIELD_NAME_MAP[key];
  return fn ? fn(faker, refDate) : null;
};

/**
 * Определяет Zod-format через _def.checks[] (для ZodString).
 * Возвращает kind первого строкового check'а (email/url/uuid/datetime/...).
 */
const getZodStringFormat = (def: Record<string, unknown>): string | null => {
  const checks = def.checks;
  if (!Array.isArray(checks)) return null;
  for (const check of checks) {
    if (check && typeof check === 'object' && 'kind' in check) {
      const kind = String((check as { kind: string }).kind);
      // Пропускаем checks, которые не связаны с форматом (min/max длина)
      if (
        kind !== 'min' &&
        kind !== 'max' &&
        kind !== 'length' &&
        kind !== 'startsWith' &&
        kind !== 'endsWith' &&
        kind !== 'includes' &&
        kind !== 'trim' &&
        kind !== 'toLowerCase' &&
        kind !== 'toUpperCase'
      ) {
        return kind;
      }
    }
  }
  return null;
};

/**
 * Читает min/max из ZodNumber._def.checks[].
 */
const getNumberConstraints = (
  def: Record<string, unknown>,
): { min: number; max: number; isInt: boolean } => {
  const checks = (def.checks as Array<{ kind: string; value: number }> | undefined) ?? [];
  let min = 0;
  let max = 1000;
  let isInt = false;

  for (const check of checks) {
    if (check.kind === 'min') min = Math.max(min, check.value);
    if (check.kind === 'max') max = Math.min(max, check.value);
    if (check.kind === 'int') isInt = true;
  }

  // Убеждаемся что min <= max (если constraints противоречат)
  if (min > max) max = min + 100;
  return { min, max, isInt };
};

/**
 * Основной рекурсивный генератор на основе faker.
 * Обходит ZodDef-дерево и генерирует валидные данные.
 *
 * Порядок резолва для каждого поля:
 *   1. Инжектированные ValueGenerator'ы (ctx.generators) — первый match побеждает.
 *   2. Маппинг по имени поля (FIELD_NAME_MAP).
 *   3. Маппинг по Zod-формату/типу (faker-база).
 *   4. Разумный фолбэк.
 */
export const generateByZodType = (
  schema: ZodTypeAny,
  ctx: Omit<GenFieldCtx, 'schema' | 'recurse'> & {
    recurse: (s: ZodTypeAny, name?: string) => unknown;
    /** Фиксированная дата-якорь для детерминизма (привязана к seed). */
    refDate: Date;
  },
): unknown => {
  const def = schema._def as Record<string, unknown>;
  const typeName = def.typeName as string | undefined;

  switch (typeName) {
    case 'ZodString': {
      // Сначала — по формату (checks)
      const format = getZodStringFormat(def);
      if (format === 'email') return ctx.faker.internet.email();
      if (format === 'url') return ctx.faker.internet.url();
      if (format === 'uuid') return ctx.faker.string.uuid();
      if (format === 'cuid' || format === 'cuid2') return ctx.faker.string.alphanumeric(24);
      if (format === 'nanoid') return ctx.faker.string.alphanumeric(21);
      if (format === 'datetime')
        return ctx.faker.date.recent({ refDate: ctx.refDate }).toISOString();
      if (format === 'date')
        return ctx.faker.date.recent({ refDate: ctx.refDate }).toISOString().split('T')[0];
      if (format === 'time')
        return ctx.faker.date
          .recent({ refDate: ctx.refDate })
          .toISOString()
          .split('T')[1]
          .split('.')[0];
      if (format === 'ip') return ctx.faker.internet.ip();
      if (format === 'cidr') return `${ctx.faker.internet.ip()}/24`;
      if (format === 'emoji') return ctx.faker.internet.emoji();
      if (format === 'base64') return Buffer.from(ctx.faker.lorem.word()).toString('base64');
      if (format === 'regex') return ctx.faker.string.alphanumeric(10);
      // Затем по имени поля
      const byName = generateByFieldName(ctx.fieldName, ctx.faker, ctx.refDate);
      if (byName !== null) return byName;
      // Фолбэк — общий lorem
      return ctx.faker.lorem.word();
    }

    case 'ZodNumber': {
      // По имени поля — может вернуть number
      const byName = generateByFieldName(ctx.fieldName, ctx.faker, ctx.refDate);
      if (typeof byName === 'number') return byName;

      const { min, max, isInt } = getNumberConstraints(def);
      return isInt
        ? ctx.faker.number.int({ min, max })
        : ctx.faker.number.float({ min, max, fractionDigits: 2 });
    }

    case 'ZodBoolean':
      return ctx.faker.datatype.boolean();

    case 'ZodDate':
      return ctx.faker.date.recent({ refDate: ctx.refDate });

    case 'ZodBigInt':
      return BigInt(ctx.faker.number.int({ min: 0, max: 1_000_000 }));

    case 'ZodNull':
      return null;

    case 'ZodUndefined':
    case 'ZodVoid':
      return undefined;

    case 'ZodAny':
    case 'ZodUnknown':
      return ctx.faker.lorem.word();

    case 'ZodNever':
      // Нельзя сгенерировать — фолбэк
      return undefined;

    case 'ZodLiteral':
      return def.value;

    case 'ZodEnum': {
      const values = def.values as unknown[];
      return ctx.faker.helpers.arrayElement(values);
    }

    case 'ZodNativeEnum': {
      const enumObj = def.values as Record<string, unknown>;
      // NativeEnum может содержать числовые ключи (reverse mapping у числовых enum'ов)
      const vals = Object.values(enumObj).filter(
        (v) => typeof v === 'string' || typeof v === 'number',
      );
      // Отфильтровываем numeric reverse mapping (строки, которые === String(number))
      const stringVals = vals.filter((v) => {
        if (typeof v === 'number') return true;
        return Number.isNaN(Number(v));
      });
      return ctx.faker.helpers.arrayElement(stringVals.length ? stringVals : vals);
    }

    case 'ZodObject': {
      const shape = def.shape as (() => Record<string, ZodTypeAny>) | Record<string, ZodTypeAny>;
      const resolvedShape = typeof shape === 'function' ? shape() : shape;
      const result: Record<string, unknown> = {};
      for (const [key, fieldSchema] of Object.entries(resolvedShape)) {
        result[key] = ctx.recurse(fieldSchema as ZodTypeAny, key);
      }
      return result;
    }

    case 'ZodArray': {
      const innerType = def.type as ZodTypeAny;
      // При рекурсии count = 3 (для вложенных массивов)
      const count = 3;
      return Array.from({ length: count }, (_, i) =>
        ctx.recurse(innerType, `${ctx.fieldName}[${i}]`),
      );
    }

    case 'ZodTuple': {
      const items = def.items as ZodTypeAny[];
      const rest = def.rest as ZodTypeAny | null;
      const tupleResult = items.map((item, i) => ctx.recurse(item, `${ctx.fieldName}[${i}]`));
      if (rest) {
        tupleResult.push(ctx.recurse(rest, `${ctx.fieldName}[rest]`));
      }
      return tupleResult;
    }

    case 'ZodRecord': {
      const valueType = def.valueType as ZodTypeAny;
      return {
        [ctx.faker.lorem.word()]: ctx.recurse(valueType, 'value'),
        [ctx.faker.lorem.word()]: ctx.recurse(valueType, 'value'),
      };
    }

    case 'ZodMap': {
      const keyType = def.keyType as ZodTypeAny;
      const valueType = def.valueType as ZodTypeAny;
      const map = new Map<unknown, unknown>();
      map.set(ctx.recurse(keyType, 'key'), ctx.recurse(valueType, 'value'));
      return map;
    }

    case 'ZodSet': {
      const valueType = def.valueType as ZodTypeAny;
      return new Set([ctx.recurse(valueType, 'item')]);
    }

    case 'ZodOptional': {
      const inner = def.innerType as ZodTypeAny;
      // Генерируем значение (не undefined) — данные полезнее
      return ctx.recurse(inner, ctx.fieldName);
    }

    case 'ZodNullable': {
      const inner = def.innerType as ZodTypeAny;
      return ctx.recurse(inner, ctx.fieldName);
    }

    case 'ZodDefault': {
      const inner = def.innerType as ZodTypeAny;
      return ctx.recurse(inner, ctx.fieldName);
    }

    case 'ZodCatch': {
      const inner = def.innerType as ZodTypeAny;
      return ctx.recurse(inner, ctx.fieldName);
    }

    case 'ZodUnion': {
      const options = def.options as ZodTypeAny[];
      const chosen = ctx.faker.helpers.arrayElement(options);
      return ctx.recurse(chosen, ctx.fieldName);
    }

    case 'ZodDiscriminatedUnion': {
      const optionsMap = def.optionsMap as Map<unknown, ZodTypeAny> | undefined;
      const opts = def.options as ZodTypeAny[] | undefined;
      if (optionsMap) {
        const values = Array.from(optionsMap.values());
        const chosen = ctx.faker.helpers.arrayElement(values);
        return ctx.recurse(chosen, ctx.fieldName);
      }
      if (opts) {
        const chosen = ctx.faker.helpers.arrayElement(opts);
        return ctx.recurse(chosen, ctx.fieldName);
      }
      return {};
    }

    case 'ZodIntersection': {
      const left = def.left as ZodTypeAny;
      const right = def.right as ZodTypeAny;
      const lVal = ctx.recurse(left, ctx.fieldName);
      const rVal = ctx.recurse(right, ctx.fieldName);
      if (lVal !== null && rVal !== null && typeof lVal === 'object' && typeof rVal === 'object') {
        return { ...(lVal as object), ...(rVal as object) };
      }
      return lVal;
    }

    case 'ZodEffects': {
      // Выгружаем схему-источник (schema или innerType)
      const inner = (def.schema ?? def.innerType) as ZodTypeAny | undefined;
      if (inner) return ctx.recurse(inner, ctx.fieldName);
      return ctx.faker.lorem.word();
    }

    case 'ZodBranded': {
      const inner = def.type as ZodTypeAny;
      return ctx.recurse(inner, ctx.fieldName);
    }

    case 'ZodReadonly': {
      const inner = def.innerType as ZodTypeAny;
      return ctx.recurse(inner, ctx.fieldName);
    }

    case 'ZodLazy': {
      const getter = def.getter as () => ZodTypeAny;
      return ctx.recurse(getter(), ctx.fieldName);
    }

    case 'ZodPromise': {
      const inner = def.type as ZodTypeAny;
      return Promise.resolve(ctx.recurse(inner, ctx.fieldName));
    }

    case 'ZodFunction':
      return () => undefined;

    default:
      // Фолбэк для неизвестных типов
      return ctx.faker.lorem.word();
  }
};
