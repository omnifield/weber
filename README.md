# Omnifield Weber

Web-framework монорепо экосистемы Omnifield: `@omnifield/*` — runtime / kit / builders /
boost / domain / cli. HCA-архитектура («UI is a Shadow»), Solid.js + XState + TanStack Router.

**Статус:** founding — миграция 🟢-волны из оракула (v1 `@capsuletech/*`,
`egor6-66/capsuleTech`). Порт-карта — [ARCHITECTURE.md](ARCHITECTURE.md).

- Канон/стандарты — `omnifield/knowledger/standards/` (KB).
- Решения — оракул `docs/01-architecture/adr/` (ADR 077/078) + аудит `docs/_meta/migration/`.
- Roadmap — GitHub-борд: https://github.com/orgs/omnifield/projects/1

## Dev

```bash
pnpm install
pnpm affected        # lint + typecheck + test + build по затронутому
```

Сессии Claude Code — через `./claude-scope.ps1 -Scope main|<zone>` (см. CLAUDE.md).
