# Бриф — weber: тест-полигон VS Code-навигации + фикс launcher exec-бита

**Статус:** downstream-верификация (не источник). **Автор:** architect-координатор (omnifield). **Исполнитель:** **weber-owner**. **Дата:** 2026-07-12 (обновлён).
**Скоуп:** `scripts/devbox-session.sh` (exec-бит) + верификация навигации. `.devcontainer/devcontainer.json` — **НЕ трогаем**, customizations придут из скелета.

> ⚠️ **Смена флоу (решение user 2026-07-12).** Раньше weber-owner сам добавлял `customizations.vscode`. Теперь **VS Code печётся в скелете devopser** (бриф `devopser/briefs/devbox-vscode-devcontainer.md`), weber **подтягивает** через `skeleton:sync`. weber = **тест-полигон навигации**, не источник. Не дублировать customizations в weber вручную.

---

## 🧭 TL;DR (для user)

5 раундов пытались протащить нашу «no-imports / глобалы» навигацию сквозь резолвер WebStorm — он by design не читает d.ts.map и не ходит `глобал → typeof import → исходник`. Решение: канон-IDE = **VS Code**, тулчейн — **в dev-контейнере** (хост чистый). VS Code юзает tsserver нативно — он навигирует наши глобалы в исходник в 1 клик (доказано). Проблема не чинится костылём — исчезает.

weber тут — **полигон**: на реальном фронте проверяем, что навигация работает, ПЕРЕД ADR.

---

## 🔧 Задача 1 — фикс exec-бита launcher'а (можно сразу, независимо)

`scripts/devbox-session.sh` потерял executable-бит (`-rw-r--r--`, грабля правки через `\\wsl.localhost`). `./scripts/devbox-session.sh` = permission denied.
- `chmod +x scripts/devbox-session.sh`, закоммитить бит (`git update-index --chmod=+x` при необходимости).
- Канон на будущее: править скрипты **из контейнера/WSL**, не через `\\wsl.localhost` (сбрасывает бит). Зафиксировано и в devopser-брифе `devbox-first-run-dx.md` (общий launcher-класс).

## 🔧 Задача 2 — верификация навигации (ПОСЛЕ того как скелет пропечёт customizations)

Гейт: сначала devopser издаёт `customizations.vscode` в скелет и weber получает их через `skeleton:sync`. Проверять — на этом.

### Пост-шаги (user на хосте)
1. VS Code + расширения хоста: **WSL** (`ms-vscode-remote.remote-wsl`) + **Dev Containers** (`ms-vscode-remote.remote-containers`).
2. `cd ~/omnifield/weber && code .` → `Ctrl+Shift+P` → **Dev Containers: Reopen in Container**.

### Протокол проверки (ради чего полигон)
1. Открыть `apps/sandbox/src/widgets/counter.tsx`.
2. Ctrl+Click (или F12) на `Views.Counter`.
3. **Ожидание:** прыжок в `apps/sandbox/src/views/counter.tsx` (исходник), в 1 клик.
4. **Доложить куда реально попал:** исходник / `.weber/globals.d.ts` / барель `.weber/registry/views/index.ts` / никуда.
5. Бонус: клик на `Entity`, `View`, `useCtx` — глобалы на `@weber/*` пакеты (навигация в пакеты: dist vs src).

---

## Дальше (по вердикту п.4)
- **Навигирует в исходник** → канон подтверждён → architect пишет ADR «canon IDE = VS Code Dev Container» + ревёрт declaration-map кодгена в weber (раунды WebStorm-костылей больше не нужны).
- **Промахивается** → `typescript.tsserver.log` (verbose, придёт из скелет-customizations), диагностируем на факте — это уже конкретный резолв tsserver, не WebStorm.
