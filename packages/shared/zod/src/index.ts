// Re-export zod-типов для advanced-кейсов (без runtime — type-only).
export type { ZodArray, ZodObject, ZodType, ZodTypeAny } from 'zod';
export type { OmnifieldZ } from './z';
export { Zod, z } from './z';
