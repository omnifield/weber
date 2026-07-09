# CLAUDE.md — Omnifield Weber

Web-framework монорепо экосистемы Omnifield (`@omnifield/*`). Миграция из оракула
`egor6-66/capsuleTech` (v1 = `@capsuletech/*`) по ADR 077 (дисциплинированная миграция)
+ ADR 078 (framework = чистый монорепо, продукты снаружи).

## Правила сессии

1. **Идентичность = scope** (`claude-scope.ps1 -Scope <x>`): `main` = architect (полный git);
   зоны (`runtime|kit|boost|domain|builders|shared|cli`) = owner (commit-only, git-gate).
   Хуки: `.claude/hooks/` (git-gate, scope-identity, scope-resolve).
2. **Канон — в KB**: `omnifield/knowledger/standards/` (POLICY, canon/, workflow/).
   Читать ДО работы. Канон едет ВПЕРЁД пакетов.
3. **Коммит-каденс**: этап → проверка (pre-commit lint+typecheck, pre-push test+build) → коммит.
   Один пакет = один этап = один коммит.

## Правила миграции (эта волна)

- **Зеркало 1-в-1**: анатомия пакета переносится из оракула буквально (пути, структура,
  тесты); меняется ТОЛЬКО бренд `@capsuletech/*` → `@omnifield/*` (+ `CapsuleSlots` →
  `OmnifieldSlots` и прочие бренд-лики). Не улучшать по ходу — фикс = отдельный этап
  с записью.
- **DoD пакета**: tests green + build green + typecheck + lint + путь в `tsconfig.base.json`.
- **Стоп-линия**: 🟢-волна = shared-zod, shared-utils, lib-builder, biome-config,
  web-state, web-router, web-query, web-style, web-dnd. Пакеты 🟡/🟠 (web-core,
  vite-builder, compliance, kit/ui, cli, …) — НЕ трогать до решений user по fork-flags
  и/или живых owner'ов (brainer).

## Раскладка (зеркало оракула, ADR 047 зоны)

```
packages/
  shared/{zod,utils}                    # tier-0 leaves
  builders/{lib,biome,vite,compliance}  # build-time
  web/
    runtime/{core,state,router,query,style,dnd,…}   # framework backbone
    kit/ui                                          # stateless UI-kit
    boost/{layout,map,table,chart,flow}             # heavy boosters
    domain/{auth,shell,placeholders,agent}          # domain packages
  cli/
```

Порт-карта и статус волны — `ARCHITECTURE.md`.
