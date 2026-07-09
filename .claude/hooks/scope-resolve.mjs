#!/usr/bin/env node
// scope-resolve.mjs — единый маппинг scope → зона weber. Двойной режим:
//   - CLI: `node scope-resolve.mjs <scope>` → stdout JSON, exit 0 (OK) | exit 1 (unknown).
//   - import: `import { resolveScope } from './scope-resolve.mjs'`.
//
// scope = имя зоны (либо 'main' = architect). Зоны weber = зеркало оракула (ADR 047):
// web/<zone> — крупные зоны фреймворка; при живых owner'ах гранулярность уточнит
// пресет-модель (brainer, роль-модель = данные).

export const ZONES = {
  runtime: { relativePath: 'packages/web/runtime', name: 'runtime — framework backbone (core/state/router/query/style/dnd/…)' },
  kit: { relativePath: 'packages/web/kit', name: 'kit — stateless UI-kit (ui)' },
  boost: { relativePath: 'packages/web/boost', name: 'boost — heavy domain boosters (layout/map/table/chart/flow)' },
  domain: { relativePath: 'packages/web/domain', name: 'domain — domain packages (auth/shell/placeholders/agent)' },
  builders: { relativePath: 'packages/builders', name: 'builders — build-time (lib/biome/vite/compliance)' },
  shared: { relativePath: 'packages/shared', name: 'shared — tier-0 leaves (zod/utils)' },
  cli: { relativePath: 'packages/cli', name: 'cli — capsule→weber CLI binary' },
};

export function resolveScope(scope) {
  if (scope === 'main') return { kind: 'main', scope: 'main' };
  const zone = ZONES[scope];
  if (!zone) return null;
  return { kind: 'zone', scope, relativePath: zone.relativePath, name: zone.name };
}

import { fileURLToPath } from 'node:url';
import { argv } from 'node:process';

if (fileURLToPath(import.meta.url) === argv[1]) {
  const scope = argv[2];
  const resolved = resolveScope(scope);
  if (!resolved) {
    const list = ['main', ...Object.keys(ZONES)].join(', ');
    process.stderr.write(`ERROR: unknown scope "${scope}". Доступные: ${list}\n`);
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(resolved));
  process.exit(0);
}
