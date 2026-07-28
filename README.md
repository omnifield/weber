# Omnifield Weber

Web-фреймворк экосистемы Omnifield. Пакеты — `@omnifield/weber-*` (канон именования — kb:MECH-15).

**Модель двух слоёв:**
- **core** — HCA-меха (обёртки слоёв, UiProxy/ControllerProxy, registry). Внешние нужды —
  через мосты (контракт кора + адаптер); инфра-плагины сборки — часть кора.
- **пакеты** — standalone Solid-библиотеки (state/router/query/style/dnd/ui/…): живут без
  кора, юзабельны в любом Solid-проекте; кор потребляет их через мосты.
- **инструменты** — generic (builder, compliance-линтер): кор — просто потребитель со своим
  конфигом.

**Миграция:** из оракула `egor6-66/capsuleTech`, итерациями, **fix-then-transfer** по аудиту
(`docs/_meta/migration/` оракула) — не copy-paste. Первый экземпляр повторяющегося
паттерна = эталон для остальных.

**Раскладка (кор и пакеты не смешиваются):**

```
core/       # меха: @omnifield/weber-* (+мосты, +инфра-плагины — по мере итераций)
packages/   # standalone Solid-пакеты (state, router, query, dnd, …)
tools/      # generic-инструменты (lib-builder, biome-config, позже compliance/builder)
```

Канон/стандарты — `omnifield/knowledger`. Roadmap — https://github.com/orgs/omnifield/projects/1

## Dev

```bash
pnpm install
pnpm hygiene    # sherif — гигиена monorepo
pnpm affected   # lint + typecheck + test + build по затронутому
```

Тулчейн пинами в репо (машина = cattle): pnpm через `packageManager`, node через
`engines`+`engine-strict`, TS project references (без tsconfig-paths — deps честные).
CI/скелет-пресеты уезжают в devopser (`briefs/repo-skeleton-product.md` там).
