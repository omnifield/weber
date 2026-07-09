/**
 * zod-generics.test-types.ts — регрессионный type-тест для OmnifieldZ.
 *
 * Проверяет: `Zod.array(schema)` и другие generic-методы сохраняют
 * конкретный тип элемента, НЕ деградируя до `any`.
 *
 * Корень фикса: `type OmnifieldZ = typeof zodRoot & { component }` вместо
 * `interface OmnifieldZ extends Omit<typeof zodRoot, never>`.
 * `Omit<T, never>` применяет mapped type к namespace модуля — это деградирует
 * generic-сигнатуры функций в non-generic property types.
 * Intersection сохраняет оригинальные сигнатуры без маппинга.
 *
 * Критерий: «если тесты прошли через зод не из нашего пакета,
 * то и с нашим должны пройти» — конструкции через `Zod` дают идентичные
 * типы конструкциям через `import { z } from 'zod'`.
 */

import { describe, it } from 'vitest';
import { z as zRaw } from 'zod';
import { Zod, z } from '../z';

// ---------------------------------------------------------------------------
// Утилиты
// ---------------------------------------------------------------------------

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;

// ---------------------------------------------------------------------------
// Тестовая схема
// ---------------------------------------------------------------------------

const IncidentSchema = zRaw.object({
  id: zRaw.string(),
  applicant: zRaw.object({ name: zRaw.string() }),
});
type Incident = zRaw.infer<typeof IncidentSchema>;

// ---------------------------------------------------------------------------
// ТЕСТ 1: Zod.array() сохраняет generic элемент
// ---------------------------------------------------------------------------

const omnifieldArr = Zod.array(IncidentSchema);
const rawArr = zRaw.array(IncidentSchema);

// Элемент массива не деградирует до any
type _T1_OmnifieldArr = typeof omnifieldArr;
type _T1_RawArr = typeof rawArr;

// Типы должны быть идентичны
type _T1_ArrayEqual = Expect<Equal<_T1_OmnifieldArr, _T1_RawArr>>;

// infer-тип через Zod совпадает с raw
type _T1_OmnifieldInfer = zRaw.infer<typeof omnifieldArr>;
type _T1_RawInfer = zRaw.infer<typeof rawArr>;
type _T1_InferEqual = Expect<Equal<_T1_OmnifieldInfer, _T1_RawInfer>>;

// НЕ any
type _T1_NotAnyArr = Expect<Equal<IsAny<_T1_OmnifieldArr>, false>>;
type _T1_NotAnyInfer = Expect<Equal<IsAny<_T1_OmnifieldInfer>, false>>;

// ---------------------------------------------------------------------------
// ТЕСТ 2: Zod.object() сохраняет shape
// ---------------------------------------------------------------------------

const omnifieldObj = Zod.object({ id: Zod.string(), name: Zod.string() });
const rawObj = zRaw.object({ id: zRaw.string(), name: zRaw.string() });

type _T2_OmnifieldObj = typeof omnifieldObj;
type _T2_RawObj = typeof rawObj;
type _T2_ObjEqual = Expect<Equal<_T2_OmnifieldObj, _T2_RawObj>>;

type _T2_OmnifieldInfer = zRaw.infer<typeof omnifieldObj>;
type _T2_RawInfer = zRaw.infer<typeof rawObj>;
type _T2_InferEqual = Expect<Equal<_T2_OmnifieldInfer, _T2_RawInfer>>;
type _T2_NotAny = Expect<Equal<IsAny<_T2_OmnifieldInfer>, false>>;

// ---------------------------------------------------------------------------
// ТЕСТ 3: Zod.string() / Zod.number() / Zod.boolean() — примитивы
// ---------------------------------------------------------------------------

// TS не принимает typeof <expr>() в generic-позиции — используем переменные
const _omnifieldStr = Zod.string();
const _rawStr = zRaw.string();
const _omnifieldNum = Zod.number();
const _rawNum = zRaw.number();
const _omnifieldBool = Zod.boolean();
const _rawBool = zRaw.boolean();

type _T3_StringEqual = Expect<Equal<typeof _omnifieldStr, typeof _rawStr>>;
type _T3_NumberEqual = Expect<Equal<typeof _omnifieldNum, typeof _rawNum>>;
type _T3_BoolEqual = Expect<Equal<typeof _omnifieldBool, typeof _rawBool>>;

// ---------------------------------------------------------------------------
// ТЕСТ 4: z (alias) — те же типы что и Zod
// ---------------------------------------------------------------------------

const zArr = z.array(IncidentSchema);
type _T4_ZArrEqual = Expect<Equal<typeof zArr, typeof omnifieldArr>>;
type _T4_ZArrNotAny = Expect<Equal<IsAny<typeof zArr>, false>>;

// ---------------------------------------------------------------------------
// ТЕСТ 5: RowOf-паттерн — critical для Shape HKT
// Zod.array(schema) → ZodArray → RowOf → Incident (не any/unknown)
// ---------------------------------------------------------------------------

type RowOf<S extends zRaw.ZodType> =
  S extends zRaw.ZodArray<infer E extends zRaw.ZodTypeAny> ? zRaw.infer<E> : zRaw.infer<S>;

const omnifieldArrForHkt = Zod.array(IncidentSchema);
type _T5_RowOf = RowOf<typeof omnifieldArrForHkt>;
type _T5_RowOfIsIncident = Expect<Equal<_T5_RowOf, Incident>>;
type _T5_RowOfNotAny = Expect<Equal<IsAny<_T5_RowOf>, false>>;

// ---------------------------------------------------------------------------
// ТЕСТ 6: z.infer совпадает с raw — identity
// ---------------------------------------------------------------------------

type _T6_InferOmnifield = zRaw.infer<typeof omnifieldArrForHkt>;
type _T6_InferRaw = zRaw.infer<ReturnType<typeof zRaw.array<typeof IncidentSchema>>>;
type _T6_InferEqual = Expect<Equal<_T6_InferOmnifield, _T6_InferRaw>>;

// ---------------------------------------------------------------------------
// ТЕСТ 7: Zod.component() — omnifield-хелпер доступен и не ломает типы
// ---------------------------------------------------------------------------

const comp = Zod.component();
// component() возвращает ZodType<JSX.Element> — проверяем через assignability
type _T7_CompIsZodType = Expect<Equal<typeof comp extends zRaw.ZodType ? true : false, true>>;

// ---------------------------------------------------------------------------
// Vitest smoke
// ---------------------------------------------------------------------------

describe('shared-zod — OmnifieldZ generic regression', () => {
  it('compiles without type errors (type assertions are the real tests at tsc level)', () => {
    // Все type-ассерты выше проверяются tsc через vitest --typecheck.
    // Этот it — только для vitest runner.
  });
});
