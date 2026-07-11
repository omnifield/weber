# Brief — порт примитивов кита (@weber/ui, волна 1)

| | |
|---|---|
| **Адресат** | owner-агенты weber (запуск — user через brainer-пульт; батчи по 2-4 примитива на сессию) |
| **От** | оракул-архитектор, 2026-07-12 |
| **Эталон** | `packages/ui/src/primitives/button/` — форма папки, конвенции, тесты. `packages/ui/OWNERSHIP.md` — читать ПЕРВЫМ |
| **Источник** | оракул `capsule/packages/web/kit/ui/src/primitives/<name>/` — fix-then-transfer, НЕ копипаст |

## Скоуп волны 1 (минимум под тонкие интерфейсы; порядок = приоритет)

| Батч | Примитивы | kindTag |
|---|---|---|
| 1 | Input, Textarea, Label | Input/Textarea → `input` |
| 2 | Card (+parts), Field (+parts), Separator | — |
| 3 | Typography, Flex, Grid, Layout | — |
| 4 | Select, Toggle | Select/Checkbox-подобные → `input` |
| 5 | List, Badge, Avatar, Skeleton, Tooltip, Dropdown | — |

НЕ в волне 1: composites (dataTable→boost, article, menu…), icons-namespace,
accordion/slider/chart/map/flow-diagram/image/group/prose/table/wrappers/widget-frame —
by-need следующими волнами.

## Правила порта (каждый примитив)

1. **Структура = эталон button**: `<name>.tsx` · `variants.ts` · `interfaces.ts` ·
   `<name>.manifest.ts` · `index.ts` · `__tests__/<name>.test.tsx`.
2. **Замены при порте**: `@capsuletech/web-style` → `@weber/style`;
   `useTrace(...)` — УДАЛИТЬ (не портируется, см. OWNERSHIP);
   `*.stories.tsx` — НЕ переносить (сторибука нет); `*.contract.ts` /
   `propsSchemaOf`/web-contract — НЕ переносить: propsSchema манифеста
   пишется из `variants` (образец — button.manifest.ts); `*.presets.ts` —
   НЕ переносить (поле пресетов придёт со студио-волной).
3. **Только токен-классы** в variants (никаких сырых цветов — канон ADR 042);
   сомнение по токену → СТОП, вопрос в бриф.
4. **Регистрация в bundle** (`src/index.ts`): компонент в `weberKit.components`,
   kind-tag в `conventions.kindTags` (если input/button-семантика), манифест
   в `manifests`. Экспорты в barrel.
5. **Тесты** — по образцу button: дефолт-рендер + data-атрибуты, варианты,
   специфика примитива (у Input — value/oninput; у Card — parts; у Select —
   kobalte raw-value onChange). Bundle-тест поймает незарегистрированное.
6. **Гейты локально**: `pnpm nx run-many -t lint typecheck test build`
   (или affected) зелёные ДО коммита. Kobalte-примитивы: если vitest падает
   на `.jsx` — dep уже в `server.deps.inline` vitest.config, НЕ менять конфиг.
7. Git: ветка `feat/kit-<batch>`, conventional commits, PR (main закрыт флоу);
   находки про эталон/движок — комментом сюда, НЕ чинить у себя.

## DoD волны

Все примитивы волны 1 в bundle с манифестами и тестами; гейты зелёные;
`weberKit.conventions.kindTags` покрывает капсульный whitelist
(Input/Textarea/Select/Checkbox → input, Button → button).
