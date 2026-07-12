/**
 * Engine-модуль аппа (конвенция build-infra: unimport берёт обёртки отсюда —
 * глобалы Entity/View/… в слоях резолвятся СЮДА, навигация честная).
 */
import { createWeberEngine } from '@weber/engine';
import { createSolidStateAdapter } from '@weber/state';
import { weberKit } from '@weber/ui';
import { z } from 'zod';

export const engine = createWeberEngine({
  kit: weberKit.components,
  adapter: createSolidStateAdapter(),
  tools: { zod: z },
  uiProxy: {
    kindTags: weberKit.conventions?.kindTags ?? {},
    rawPassthroughKeys: new Set(weberKit.conventions?.rawPassthroughKeys ?? []),
  },
});

export const { Entity, View, Shape, Widget, Page, Controller, Feature } = engine;
