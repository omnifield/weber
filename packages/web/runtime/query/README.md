# @omnifield/web-query

Декларативный HTTP-слой Weber: `defineEndpoint` + `createApi` + koa-style middleware-pipeline. Feature видит typed-proxy `services.api.user.get({ id })`, не зная про fetch, кэш или маппинг ошибок.

Подпуть `@omnifield/web-query/app-config` экспортирует `IAppConfig` — контракт для `apps/<app>/weber.app.ts` (раньше жил в `@omnifield/web-core`).

Документация — в Obsidian-vault'е:

- `docs/09-packages/api-middleware.md` — обзор пакета, endpoint-DSL, middleware-toolbox, типизация `services.api`.

Сборка: `pnpm nx build @omnifield/web-query` (Vite через `@omnifield/lib-builder`, два entry: `index` + `app-config`).
Тесты: `pnpm --filter @omnifield/web-query test` (147 шт., node-env).
