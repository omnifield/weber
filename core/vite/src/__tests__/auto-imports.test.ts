import { describe, expect, it } from 'vitest';
import { buildAutoImports, REGISTRY_NAMES, WRAPPER_NAMES } from '../auto-imports';

describe('buildAutoImports — глобалы поверх настоящих модулей', () => {
  it('обёртки из engine-модуля аппа, реестры из барелей, хуки из кора', () => {
    const imports = buildAutoImports();
    const flat = Object.assign({}, ...imports) as Record<string, string[]>;
    expect(flat['@weber-app/engine']).toEqual([...WRAPPER_NAMES]);
    expect(flat['@weber-app/registry']).toEqual([...REGISTRY_NAMES]);
    expect(flat['@weber/kernel']).toContain('useCtx');
    expect(flat['@weber/logic']).toContain('useEmit');
  });

  it('пути переопределяются опциями', () => {
    const imports = buildAutoImports({
      engineModule: '~/boot/engine',
      registryModule: 'virtual:reg',
    });
    const flat = Object.assign({}, ...imports) as Record<string, string[]>;
    expect(flat['~/boot/engine']).toBeDefined();
    expect(flat['virtual:reg']).toBeDefined();
  });
});
