# @omnifield/web-style

Styling-слой Weber: `createStyle` (CVA-обёртка), `cn`/`merge` helpers, реестр тем (CSS-файлы) и редактор тем (`ThemeEditor` + `ThemeSwitcher`).

Подпуть `/editor` — UI редактора (живёт за prop-флагом, чтобы прод-бандлы apps не тянули overhead). Подпути `/css` и `/themes` отдают сырые CSS-файлы для импорта в `apps/<app>` (через `createRoot` это делается автоматически).

Документация — в Obsidian-vault'е:

- `docs/09-packages/style.md` — обзор пакета.

Сборка: `pnpm nx build @omnifield/web-style` (Vite + копирование CSS в dist).
Тесты: `pnpm --filter @omnifield/web-style test` (28 шт., node-env: `utils`, `editor/oklch`, `editor/export`).
