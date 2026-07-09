# @omnifield/shared-zod

Omnifield-расширенный `zod`-namespace. Внутри одна точка — `z.component()` для Solid JSX-renderable значений; будут добавляться доменные хелперы по мере появления (теги, ссылки, алиасы).

Пользователь напрямую этот пакет не импортирует — он получает `zod` через объект-инъекцию (деструктуризация `{ zod }`) в data-фабриках:

```ts
Entity(({ zod }) => ({ schema: zod.object({ name: zod.string() }) }))

Shape((ui, { zod }) => ({ schema: zod.object({ id: zod.number() }), as: ui.DataTable }),
      (ui, props) => ({ ... }))

defineEndpoint(({ zod }) => ({ ... }))
```

Это часть API-договора фреймворка.

> Под капотом shallow-spread `{ ...zodRoot }`, а не прототипная цепочка —
> чтобы обойти frozen ESM Module-namespace после `optimizeDeps` Vite'а.
> Оригинальный `zod` НЕ мутируется.

Сборка: `pnpm nx build @omnifield/shared-zod`.
