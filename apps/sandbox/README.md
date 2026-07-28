# sandbox — verification-полигон build-infra

Мини-апп на ПОЛНОМ стеке weber: `@omnifield/weber-engine` (модульный кор) + `@omnifield/weber-ui`
(kit-bundle) + `@omnifield/weber-state` (solid-адаптер) + `@omnifield/weber-vite` (defineWeberApp:
registry-барели + unimport-глобалы). Слои написаны КАНОНОМ — без импортов
(Entity/View/Widget/Feature, Entities/Views/Features/Widgets, useCtx — глобалы).

- `vite build` (nx build) = e2e-гейт build-infra в CI.
- `.weber/` (registry-барели + auto-imports.d.ts) — ГЕНЕРИРУЕТСЯ, но
  закоммичен: typecheck в CI не зависит от порядка тасок; регенерация
  идемпотентна (drift виден диффом).
- Заодно — полигон глазения кита по мере порта примитивов
  (briefs/kit-primitives-port.md).

Запуск: `pnpm dev` из этой папки → http://localhost:5173.
