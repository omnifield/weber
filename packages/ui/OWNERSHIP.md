# OWNERSHIP — @weber/ui

Stateless UI-kit. Итерация 1 = каркас + контракт `IKitBundle` + эталон-примитив
Button (со Slot/Spinner — его дерево deps). Остальные примитивы — по брифу
`briefs/kit-primitives-port.md` (owner-агенты, эталон = папка button).

## Контракт кита (решение user 2026-07-12)

`IKitBundle` = `{ components, conventions, manifests }` — кит экспортирует
себя одним свёртком (`weberKit`); сборка мержит НЕСКОЛЬКО bundle'ов
(`mergeKitBundles`) — это конструктивное решение augmentation-модели
(fork-flag #10 предка): боковой пакет/юзерский компонент = ещё один bundle.

- `conventions.kindTags` — ui-proxy whitelist ПРИВОЗИТ КИТ (слот движка готов).
- `manifests` — `*.manifest.ts` РЯДОМ с компонентом; студио читает любой
  набор этого shape. Упрощение против предка: без contract-слоя
  (web-contract → embed/validation-волна), без bundle-cost автогена
  (build-скрипт придёт со студио), без presets-поля (по мере пресетов).

## Конвенции примитива (эталон = primitives/button/)

Папка: `<name>.tsx` + `variants.ts` (CVA, только токен-классы) +
`interfaces.ts` (VariantProps + явные class/style/children для полиморфного
splitProps) + `<name>.manifest.ts` (propsSchema из variants — один источник
правды) + `index.ts` + `__tests__`. Атрибуты: `data-slot` (selector-хук),
`data-variant`/`data-size`, Kobalte-конвенция `data-disabled`. Полиморфизм —
через Slot (Kobalte Polymorphic).

## Решения порта

- **Storybook УБРАН** (решение user): showcase-роль — студио; до неё
  верификация = jsdom-тесты + первый реальный апп (build-infra).
- **useTrace предка не портирован** (тянул web-profiler в кит) —
  kit-observability вернётся слотом с profiler-волной.
- zod = peer (схемы манифестов — данные); kobalte = dep.

## Тесты

Button-эталон (варианты/полиморфизм/loading/fullWidth/onClick) +
bundle-контракт (kindTags ссылаются на существующие компоненты; манифесты
валидны, propsSchema парсит defaultProps; merge augmentation-сценария).

## Квирк тестов

kobalte шипит `.jsx` в dist → `server.deps.inline` в vitest.config
(зеркало грабли предка).
