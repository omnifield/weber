# Architecture — Omnifield Weber

Repo-local north star. Решения — оракул `egor6-66/capsuleTech` (ADR 077 миграция,
ADR 078 ярусы, ADR 047 зоны); дисциплина — `omnifield/knowledger/standards/`;
полный аудит базы — оракул `docs/_meta/migration/` (тиры 🟢/🟡/🟠/🔴, CC-шки, fork-flags).

## Место в экосистеме (ADR 078 §2-3)

**Framework-ярус**: чистый монорепо `@omnifield/*`, co-release (не дробим — version-hell).
Продукты (brainer/writer/…) потребляют его по npm; capability-движки (backend) — отдельный
ярус. learn/studio/docs = продукты, В ЭТОТ репо НЕ входят (workspace-зона оракула растворена).

## Порт-карта 🟢-волны (текущая)

| Оракул (`@capsuletech/*`) | Weber (`@omnifield/*`) | Статус |
|---|---|---|
| `packages/shared/zod` shared-zod | `packages/shared/zod` | ⬜ |
| `packages/shared/utils` shared-utils | `packages/shared/utils` | ⬜ |
| `packages/builders/lib` lib-builder | `packages/builders/lib` | ⬜ |
| `packages/builders/biome` biome-config | `packages/builders/biome` | ⬜ |
| `packages/web/runtime/state` web-state | `packages/web/runtime/state` | ⬜ |
| `packages/web/runtime/router` web-router | `packages/web/runtime/router` | ⬜ |
| `packages/web/runtime/query` web-query | `packages/web/runtime/query` | ⬜ |
| `packages/web/runtime/style` web-style | `packages/web/runtime/style` | ⬜ |
| `packages/web/runtime/dnd` web-dnd | `packages/web/runtime/dnd` | ⬜ |

Правило порта: **зеркало 1-в-1** (структура/тесты/доки как в оракуле), меняется только
бренд. Найденный по ходу дефект — surface + отдельный этап, не «фикс заодно».

## Стоп-линия волны

🟡/🟠-пакеты ждут: (а) решений user по fork-flags аудита (#1 AppSourceServe,
#5 web-remote, #9 desktop, #10 augmentation-модель), (б) закрытия CC-4 (web-core↔vite-builder
dep) и CC-10 (store.ctx typing) У ИСТОЧНИКА при порте, (в) живых owner'ов (brainer).
Особые: compliance — порт вместе с fork-#2 фиксом (shapes/entities в LAYER_RX);
web-agent — 🔴 rebuild против backend/llm, не порт.

## Владение

Пока живых owner'ов нет: волну ведёт оракул-архитектор (авторизация user 2026-07-09,
запись на Migration-борде). С появлением brainer-оркестрации зоны переходят owner'ам
по пресет-модели (роль-модель = данные, хуки = интерпретаторы).
