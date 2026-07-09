import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { gen, genList, registerGenerator, unregisterGenerator } from '../gen/index';
import type { ValueGenerator } from '../gen/types';

// ---------------------------------------------------------------------------
// Тестовые схемы
// ---------------------------------------------------------------------------

const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  age: z.number().int().min(0).max(120),
  active: z.boolean(),
  createdAt: z.string().datetime(),
});

const AddressSchema = z.object({
  city: z.string(),
  country: z.string(),
  zip: z.string(),
});

const ProductSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  price: z.number(),
  tags: z.array(z.string()),
  address: AddressSchema,
});

const StatusEnum = z.enum(['open', 'closed', 'pending']);
const NativeStatusEnum = { Open: 'open', Closed: 'closed', Pending: 'pending' } as const;
const NativeStatusZod = z.nativeEnum(NativeStatusEnum);

// ---------------------------------------------------------------------------
// 1. Детерминизм по seed
// ---------------------------------------------------------------------------

describe('gen — детерминизм', () => {
  it('одинаковый seed даёт одинаковый результат (примитив)', () => {
    const a = gen(z.string().email(), { seed: 42 });
    const b = gen(z.string().email(), { seed: 42 });
    expect(a).toBe(b);
  });

  it('одинаковый seed даёт одинаковый результат (объект)', () => {
    const a = gen(UserSchema, { seed: 123 });
    const b = gen(UserSchema, { seed: 123 });
    expect(a).toEqual(b);
  });

  it('разные seeds дают разные результаты', () => {
    const a = gen(UserSchema, { seed: 1 });
    const b = gen(UserSchema, { seed: 2 });
    // Хотя бы одно поле должно отличаться
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('одинаковый seed для массива даёт одинаковый результат', () => {
    const a = gen(z.array(UserSchema), { seed: 99, count: 5 });
    const b = gen(z.array(UserSchema), { seed: 99, count: 5 });
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// 2. Валидность — schema.parse(gen(schema)) не кидает
// ---------------------------------------------------------------------------

describe('gen — валидность данных', () => {
  it('z.string().email()', () => {
    const val = gen(z.string().email(), { seed: 1 });
    expect(() => z.string().email().parse(val)).not.toThrow();
  });

  it('z.string().uuid()', () => {
    const val = gen(z.string().uuid(), { seed: 1 });
    expect(() => z.string().uuid().parse(val)).not.toThrow();
  });

  it('z.string().url()', () => {
    const val = gen(z.string().url(), { seed: 1 });
    expect(() => z.string().url().parse(val)).not.toThrow();
  });

  it('z.number().int()', () => {
    const schema = z.number().int().min(0).max(120);
    const val = gen(schema, { seed: 1 });
    expect(() => schema.parse(val)).not.toThrow();
  });

  it('z.boolean()', () => {
    const val = gen(z.boolean(), { seed: 1 });
    expect(typeof val).toBe('boolean');
  });

  it('z.enum()', () => {
    const val = gen(StatusEnum, { seed: 1 });
    expect(() => StatusEnum.parse(val)).not.toThrow();
  });

  it('z.nativeEnum()', () => {
    const val = gen(NativeStatusZod, { seed: 1 });
    expect(() => NativeStatusZod.parse(val)).not.toThrow();
  });

  it('z.literal()', () => {
    const schema = z.literal('hello');
    const val = gen(schema, { seed: 1 });
    expect(val).toBe('hello');
  });

  it('z.object() плоский', () => {
    const val = gen(UserSchema, { seed: 1 });
    expect(() => UserSchema.parse(val)).not.toThrow();
  });

  it('z.object() вложенный', () => {
    const val = gen(ProductSchema, { seed: 1 });
    expect(() => ProductSchema.parse(val)).not.toThrow();
  });

  it('z.array(schema) — count влияет на длину', () => {
    const val = gen(z.array(z.string()), { seed: 1, count: 7 });
    expect(Array.isArray(val)).toBe(true);
    expect((val as string[]).length).toBe(7);
  });

  it('z.optional() генерирует значение (не undefined)', () => {
    const schema = z.object({ name: z.string().optional() });
    const val = gen(schema, { seed: 1 }) as { name?: string };
    // Мы генерируем значение даже для optional, чтобы данные были полезными
    expect(typeof val.name).toBe('string');
    expect(() => schema.parse(val)).not.toThrow();
  });

  it('z.nullable() генерирует значение', () => {
    const schema = z.object({ name: z.string().nullable() });
    const val = gen(schema, { seed: 1 }) as { name: string | null };
    expect(() => schema.parse(val)).not.toThrow();
  });

  it('z.union() генерирует одну из ветвей', () => {
    const schema = z.union([z.string(), z.number()]);
    const val = gen(schema, { seed: 1 });
    expect(() => schema.parse(val)).not.toThrow();
  });

  it('z.default() генерирует значение', () => {
    const schema = z.object({ role: z.string().default('user') });
    const val = gen(schema, { seed: 1 });
    expect(() => schema.parse(val)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 3. Инъекция ValueGenerator'а — перебивает faker-базу
// ---------------------------------------------------------------------------

describe('gen — injectable generators', () => {
  it('generator с match=true перебивает faker-базу', () => {
    const customEmail = 'custom@test.example';
    const customGen: ValueGenerator = {
      id: 'test-email',
      match: (ctx) => ctx.fieldName === 'email',
      generate: () => customEmail,
    };

    const user = gen(UserSchema, { seed: 42, generators: [customGen] });
    expect((user as { email: string }).email).toBe(customEmail);
  });

  it('generator с match=false НЕ применяется', () => {
    const customGen: ValueGenerator = {
      id: 'test-never-matches',
      match: () => false,
      generate: () => 'should-never-appear',
    };

    const user = gen(UserSchema, { seed: 42, generators: [customGen] }) as { email: string };
    expect(user.email).not.toBe('should-never-appear');
    // email всё равно валидный
    expect(() => z.string().email().parse(user.email)).not.toThrow();
  });

  it('order определяет порядок — меньший order побеждает', () => {
    const lowPriority: ValueGenerator = {
      id: 'low',
      match: (ctx) => ctx.fieldName === 'firstName',
      generate: () => 'LowPriority',
      order: 10,
    };
    const highPriority: ValueGenerator = {
      id: 'high',
      match: (ctx) => ctx.fieldName === 'firstName',
      generate: () => 'HighPriority',
      order: -1,
    };

    const user = gen(UserSchema, {
      seed: 42,
      generators: [lowPriority, highPriority],
    }) as { firstName: string };
    expect(user.firstName).toBe('HighPriority');
  });

  it('generator получает корректный ctx.path', () => {
    const paths: string[][] = [];
    const capturingGen: ValueGenerator = {
      id: 'capture-path',
      match: (ctx) => {
        paths.push(ctx.path);
        return false; // не перебиваем, просто записываем
      },
      generate: () => undefined,
    };

    gen(UserSchema, { seed: 1, generators: [capturingGen] });
    // Поля объекта имеют путь ['fieldName']
    expect(paths.some((p) => p.includes('email'))).toBe(true);
    expect(paths.some((p) => p.includes('id'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Array count
// ---------------------------------------------------------------------------

describe('gen — array count', () => {
  it('gen(z.array(...), { count: N }) генерирует N элементов', () => {
    for (const count of [1, 5, 10, 20]) {
      const result = gen(z.array(UserSchema), { seed: 1, count });
      expect(Array.isArray(result)).toBe(true);
      expect((result as unknown[]).length).toBe(count);
    }
  });

  it('genList(schema, { count: N }) генерирует N элементов', () => {
    const result = genList(UserSchema, { seed: 7, count: 4 });
    expect(result.length).toBe(4);
  });

  it('genList даёт тот же результат что gen(z.array(...))', () => {
    const fromGen = gen(z.array(UserSchema), { seed: 55, count: 3 });
    const fromGenList = genList(UserSchema, { seed: 55, count: 3 });
    expect(fromGen).toEqual(fromGenList);
  });
});

// ---------------------------------------------------------------------------
// 5. registerGenerator / unregisterGenerator
// ---------------------------------------------------------------------------

describe('registerGenerator', () => {
  afterEach(() => {
    unregisterGenerator('global-test-gen');
  });

  it('глобальный generator применяется без передачи в options', () => {
    registerGenerator({
      id: 'global-test-gen',
      match: (ctx) => ctx.fieldName === 'email',
      generate: () => 'global@test.example',
    });

    const user = gen(UserSchema, { seed: 1 }) as { email: string };
    expect(user.email).toBe('global@test.example');
  });

  it('unregisterGenerator убирает глобальный generator', () => {
    registerGenerator({
      id: 'global-test-gen',
      match: (ctx) => ctx.fieldName === 'email',
      generate: () => 'global@test.example',
    });
    unregisterGenerator('global-test-gen');

    const user = gen(UserSchema, { seed: 1 }) as { email: string };
    // Теперь должен использоваться faker — email валидный, но не 'global@test.example'
    expect(user.email).not.toBe('global@test.example');
    expect(() => z.string().email().parse(user.email)).not.toThrow();
  });

  it('повторная регистрация с тем же id заменяет существующий', () => {
    registerGenerator({
      id: 'global-test-gen',
      match: (ctx) => ctx.fieldName === 'email',
      generate: () => 'first@test.example',
    });
    registerGenerator({
      id: 'global-test-gen',
      match: (ctx) => ctx.fieldName === 'email',
      generate: () => 'second@test.example',
    });

    const user = gen(UserSchema, { seed: 1 }) as { email: string };
    expect(user.email).toBe('second@test.example');
  });
});

// ---------------------------------------------------------------------------
// 6. Маппинг имён полей
// ---------------------------------------------------------------------------

describe('gen — маппинг имён полей', () => {
  it('поле "firstName" → faker.person.firstName (строка, не пустая)', () => {
    const schema = z.object({ firstName: z.string() });
    const val = gen(schema, { seed: 1 }) as { firstName: string };
    expect(typeof val.firstName).toBe('string');
    expect(val.firstName.length).toBeGreaterThan(0);
  });

  it('поле "email" → faker.internet.email (валидный email)', () => {
    const schema = z.object({ email: z.string() });
    const val = gen(schema, { seed: 1 }) as { email: string };
    expect(val.email).toContain('@');
  });

  it('поле "city" → faker.location.city (строка, не пустая)', () => {
    const schema = z.object({ city: z.string() });
    const val = gen(schema, { seed: 1 }) as { city: string };
    expect(typeof val.city).toBe('string');
    expect(val.city.length).toBeGreaterThan(0);
  });
});
