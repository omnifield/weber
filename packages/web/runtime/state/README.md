# @omnifield/web-state

XState-обвязка weber: `createState` (FSM-factory с GOTO event injection) + `createBridge` (геттер-обёртка вокруг XState state/send + tag-операции `pick`/`omit`/`match`/`matchEntry`) + tag-registry (alias expansion `@inputs` → set of tags).  ·  zone: **runtime**  ·  status: **stable (0.1.1)**

## Install

```bash
pnpm add @omnifield/web-state
# peer deps:
pnpm add solid-js xstate
```

## Minimum usage

```ts
import { createState, createBridge } from '@omnifield/web-state';

// FSM-factory (используется web-core внутри Controller/Feature wrappers):
const machine = createState({
  initial: 'idle',
  states: {
    idle:    { onStart: 'loading' },
    loading: { onSuccess: 'done', onError: 'error' },
    done:    {},
    error:   {},
  },
});

// Tag-helpers через bridge:
bridge.pick(['@inputs']);            // → все теги в alias '@inputs'
bridge.matchEntry('input', { id: 'email' });
```

В weber-аппе `createState` инкапсулирован в HCA wrapper'ах `Controller` / `Feature` — пиши FSM-schema, web-core делает остальное.

## Docs

- AI-anchor: [`docs/_meta/web-state.md`](../../../docs/_meta/web-state.md)
- Zone canon: [`docs/_meta/web-zones/runtime.md`](../../../docs/_meta/web-zones/runtime.md)
- OWNERSHIP: [`./OWNERSHIP.md`](./OWNERSHIP.md)
- ADR 001 (XState canon), ADR 005 (tag aliases), ADR 008 (single FSM engine).
