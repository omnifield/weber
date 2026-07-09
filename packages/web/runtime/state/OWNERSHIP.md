---
name: "@omnifield/web-state"
owner-agent: owner-web-state
group: web_base
zone: runtime
status: stable
priority: P0
last-updated: 2026-06-11
---

# OWNERSHIP — @omnifield/web-state

Owner agent: **owner-web-state**
Package path: `packages/web/state/`
Version: 0.1.1
Release group: `web_base` (fixed-versioning, tag `web@{version}`)

## Состояние (читать ПЕРВЫМ)

- **Zone:** `runtime` — XState-обвязка для weber. `createState` (FSM factory с GOTO event injection) + `createBridge` (геттер-обёртка + tag-helpers `pick/omit/match/matchEntry`).
- **Status:** `stable` (0.1.1) — публичный API используется web-core (createLogicWrapper) + всеми Controllers/Features.
- **Priority:** **P0** — основа FSM-слоя HCA.
- **Maturity bar (до 1.0):**
  - Tag-registry alias canon (`@inputs` → multi-tag expansion, ADR 005).
  - IBaseStateSchema unification с web-core extending (Phase F).
  - 100% type-coverage публичного API.
- **Active blockers:** нет.
- **Roadmap:**
  1. Tag-registry alias canonization.
  2. Bridge API stabilization (`store.update`, `pick/omit/match`).
  3. Schema type unification (Phase F per memory).
- **Last activity:** 2026-06-11 (canon refresh).

## Vendor stack (ADR 047 D3)

- **Solid.js** (`solid-js` `^1.9.12`, peerDep) — реактивный фреймворк. https://docs.solidjs.com/
- **XState** (`xstate` `^5`, peerDep) — FSM движок. https://stately.ai/docs
- **`@xstate/solid`** (transitive через web-core) — Solid adapter.
- **es-toolkit** (`^1`, dep) — utility helpers. https://es-toolkit.dev/

## Zone of responsibility

This package owns:
- `src/bridge.ts` — `createBridge` factory; `IBridge` public API; all bridge mutators.
- `src/create.ts` — `createState(schema)` XState machine factory; `IBaseStateSchema` canonical type; `IMachineContext` shape.
- `src/helpers.ts` — pure tag-helpers: `pickByTags / omitByTags / matchByTags / matchEntryByTags`.
- `src/tag-registry.ts` — `registerAliases / expandTags / getAliases / clearAliases`.
- `src/index.ts` — barrel re-exports.
- `src/__tests__/` — unit tests for all of the above.

Do NOT touch: `packages/web/core/` or any other package. Cross-package changes escalate to main assistant.

## Public API surface

```ts
// Machine factory
createState(schema: IBaseStateSchema): AnyStateMachine

// Bridge factory (wraps useMachine output → store API for Controller/Feature handlers)
createBridge(state: IBridgeStateSnapshot, send: IBridgeSend): IBridge

// Tag helpers (pure, no reactive context needed)
pickByTags / omitByTags / matchByTags / matchEntryByTags

// Tag-alias registry
registerAliases / expandTags / getAliases / clearAliases

// Types
IBaseStateSchema, IMachineContext, IBridge, IBridgeStateSnapshot, IBridgeSend,
IRegisteredComponent, BridgeMatchOptions, MatchOptions, ComponentData
```

## IBridge mutator API

| Method | XState event | Notes |
|---|---|---|
| `update(payload)` | `SET_DATA` | Merges into `context.data`. **Sanitised** — see aliasing invariant below. |
| `setLoading(bool)` | `SET_LOADING` | |
| `setStyles(record)` | `SET_STYLES` | |
| `setErrors(record)` | `SET_ERRORS` | |
| `setProps(record)` | `SET_PROPS` | Per-id prop patches for UiProxy; values are primitive control flags (not domain objects). |
| `registerComponent(payload)` | `REGISTER_COMPONENT` | Mount-time, once per component. |
| `unregisterComponent(id)` | `UNREGISTER_COMPONENT` | Removes from `components` and `props`. |
| `updateComponent(payload)` | `UPDATE_COMPONENT` | Runtime patch (value/type); unknown id silently skipped. |
| `patch(tags, patchOrFn)` | `SET_PROPS` | Tag-based `setProps`; one atomic send for all matches. |
| `pick / omit / match / matchEntry / values` | — | Read-only tag queries over `components`. |

## Aliasing invariant for `update()` (critical — do not remove)

**Problem:** `store.ctx.data.items.find(i => i.id === id)` returns a Solid **store proxy node** — a live reactive handle backed by `$RAW` internals. If that proxy is passed directly to `store.update({ selected: item })`, XState/`@xstate/solid`'s reconcile aliases `data.selected` and `data.items[k]` to the same internal store node. The next `update({ selected: otherItem })` then physically overwrites `items[k]` as a side effect, corrupting the items array.

**Fix (implemented 2026-05-30):** `update()` runs `sanitisePayload` before dispatching `SET_DATA`:
1. `unwrap(payload)` — `solid-js/store`'s `unwrap` strips proxy wrappers recursively. For plain objects (not store proxies) this is a no-op. For proxy nodes it extracts the raw underlying value via `$RAW`.
2. `structuredClone(unwrapped)` — deep-clones the unwrapped plain object, ensuring no reference from the payload can alias any existing `context.data` field in the actor.

**Invariant:** The object dispatched to `SET_DATA` must share **no** internal Solid store node identity with any existing field in `context.data`.

**Contract for callers:** `update()` payload values must be serialisable data (no Functions, Symbols, WeakMaps, DOM nodes). This was always implicit in the data-mutation contract; `structuredClone` makes it explicit.

**Why only `update()` and not other mutators:**
- `setProps` / `registerComponent` / `updateComponent` receive values from UiProxy internals (derived primitive flags, JSX prop objects) — not user domain objects read from `store.ctx.data`. Risk is theoretical; the perf cost of cloning every `updateComponent` call (fired on every `onInput` event) would be significant.
- `update()` is the only mutator that receives arbitrary domain objects from user handlers and is the confirmed source of aliasing.
- If aliasing is ever observed in `setProps` (e.g., passing a store-proxy object as a prop value), apply the same pattern.

**Regression test:**
- Unit: `packages/web/state/src/__tests__/bridge.test.ts` — `createBridge — update() aliasing invariant` suite.
- Integration (web-core zone): `packages/web/core/src/engine/__tests__/store-aliasing.repro.test.ts` — end-to-end repro using real `useMachine`. Marked `.repro.test.ts` (temporary); main assistant to coordinate its final home.

## IBaseStateSchema — canonical location

`IBaseStateSchema` lives here, in `create.ts`. This is the **single source of truth** for the engine-level FSM shape. `web-core` extends it (`IDefineStateSchema extends IBaseStateSchema`) — never invert. Adding controller/feature-specific fields to `IBaseStateSchema` would create a dependency cycle.

## Known quirks / gotchas

1. **`createState` returns a machine, NOT an actor.** Actor creation is in `createLogicWrapper` (web-core) via `@xstate/solid`. Do not call `interpret()` or `createActor()` here.
2. **GOTO injection** — `state.set(name)` → `send({ type: '__GOTO_name__' })`. These transitions are injected automatically by `createState` for every state name. Manual `'__GOTO_*__'` definitions in schema will conflict.
3. **`store.update()` vs `store.updateComponent()`** — `update()` is SET_DATA → `context.data` (user state). `updateComponent()` is UPDATE_COMPONENT → `context.components[id]` (UiProxy internal). Do not confuse in new API.
4. **`store.values(tags)` skips nameless components.** `<Button meta={{tags:['@submit']}}>` has no `name` → `store.values(['@submit'])` returns `{}`. Last-write-wins on duplicate names (developer mistake, not a feature).
5. **`pickByTags` mode default = 'any', `matchByTags` mode default = 'all'.** Document explicitly in new helpers.
6. **Tag aliases are global** — registered on `BaseProviders` mount; cleared on unmount. In SSR with multiple roots this is a race. CSR-only currently; SSR needs Provider-scope isolation (ADR candidate).
7. **`registerAliases` is accumulative** — repeated calls merge. Use `clearAliases()` in test setup to avoid leaks between tests.
8. **`registerComponent` vs `updateComponent`** — Register is mount-time (meta + name). Update is runtime patch (value/type). Unknown id in UPDATE is silently skipped — intentional; order of mount/event must not crash the app. (PR #166)

## Test coverage

| File | What it covers |
|---|---|
| `__tests__/create.test.ts` | `createState` schema → machine, GOTO injection, all store events |
| `__tests__/bridge.test.ts` | `createBridge` getters, all mutators, tag ops, aliasing invariant |
| `__tests__/helpers.test.ts` | All 4 tag-helpers with edge cases |
| `__tests__/tag-registry.test.ts` | registerAliases accumulation, expandTags, clearAliases |

Run: `pnpm --filter @omnifield/web-state test`

## Dependencies

- `solid-js/store` (peer) — `unwrap` used in `sanitisePayload` inside `update()`.
- `xstate` (peer) — `createMachine`, `assign`.
- `es-toolkit` (direct) — array/object utilities for tag-helpers.

## Consumers

- **`web-core`** — primary consumer; `createState` + `createBridge` called from `createLogicWrapper`. Breaking change here = breaking for all Controller/Feature schemas in apps.
- **`web-query`** — uses `IBridge` inside Features via services (runtime coupling, not direct dep).

## Roadmap

- [ ] `docs/_meta/web-state.md` AI anchor (currently missing)
- [ ] SSR-aware tag-registry via Provider-scope
- [ ] `createState` schema validation via zod (early detection of state-name typos)
- [ ] Relocate Bridge integration tests from web-core into this package
