# OWNERSHIP — @omnifield/weber-style

Styling-слой: токен-КОНТРАКТ + createStyle/cn + zero-config light/dark +
кастомные палитры конфигом (решения user 2026-07-12).

## Публичный API

- **Токен-контракт** (`tokens.ts`): `PALETTE_TOKENS` (32 цветовых, обязательное
  ядро) + `THEME_META_TOKENS` (шрифты/радиус/тени/трекинг, опционально) —
  канон ADR 042 предка (set FROZEN), впервые оформлен ТИПОМ. `IThemeDefinition`
  = тема как данные. `DEFAULT_LIGHT`/`DEFAULT_DARK` + `themeToCss`.
- **Механика тем** (`theme.ts`): `registerTheme(def)` — кастомная палитра
  инжектится рантаймом (`[data-theme=…]`), идемпотентно;
  `createThemeController(opts)` — PER-INSTANCE сигналы (palette × mode),
  опц. localStorage-персист, `.dark` с body-зеркалом (MutationObserver-грабля).
- `createStyle` (CVA-обвязка) · `cn`/`merge`/`cva` · `STATUS_VARIABLES`.
- CSS-субпаты: `@omnifield/weber-style/css` (base: tailwind-алиасы, density/motion/
  radii-шкалы, kobalte-анимации, скроллбар, base-reset) ·
  `@omnifield/weber-style/themes.css` (дефолт-пара `:root`+`.dark`).

## Решения порта (отличия от предка)

- **11 вшитых палитр НЕ перенесены** (контент апп-уровня; приходят
  `registerTheme`-конфигом) — с ними умер `import.meta.glob` build-coupling.
- **Дефолт zero-config**: `:root` = light, `.dark` = dark; `data-theme` —
  только кастомные палитры.
- **7 fontsource-шрифтов не тащим** — шрифт задаёт тема/апп; body имеет
  system-стек fallback.
- **Непрофильные switcher'ы предка** (dndMode/resizeMode/finishMode/
  settingsMode/ambient — module-global app-режимы В STYLE-ПАКЕТЕ) — не
  портированы; вернутся со своими владельцами инъекциями.
- **View-transitions CSS** (ADR 046, привязан к router-Outlet) — router-волна.
- Канон-фикс: shadow-токены дефолта — нормальная tw-шкала (у «black» предка
  были отключены хаком -50px/opacity-0).

## Тесты = канон-гейт токенов

`tokens.test`: обе темы покрывают ПОЛНОЕ ядро · нет токенов вне контракта ·
**themes.css синхронен с TS токен-в-токен** (парс-сравнение) · base.css мапит
каждый токен в tailwind-алиас. + механика тем/контроллер/утилиты (14).
