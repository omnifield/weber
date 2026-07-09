import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import {
  defineEndpoint,
  type Endpoint,
  type EndpointTools,
  type InferInput,
  type InferOutput,
} from '../endpoint';

// defineEndpoint — фабрика, factory принимает { zod, utils }.
// Тесты держат runtime-shape и type-inference сигнатур.

describe('defineEndpoint — runtime', () => {
  it('returns { config } with shape from factory', () => {
    const ep = defineEndpoint(({ zod }) => ({
      method: 'GET',
      path: '/users/:id',
      request: zod.object({ id: zod.string() }),
      response: zod.object({ id: zod.string(), email: zod.string() }),
    }));
    expect(ep.config.method).toBe('GET');
    expect(ep.config.path).toBe('/users/:id');
    expect(ep.config.request).toBeDefined();
    expect(ep.config.response).toBeDefined();
  });

  it('does NOT call request/response schemas at definition time', () => {
    let called = false;
    const dummy = z.object({}).transform((v) => {
      called = true;
      return v;
    });
    defineEndpoint(() => ({
      method: 'GET',
      path: '/x',
      response: dummy,
    }));
    expect(called).toBe(false);
  });

  it('preserves map / staleTime / middleware / base / preRequest', () => {
    const map = (dto: any) => ({ ...dto, wrapped: true });
    const preRequest = ({ resolve }: any) => resolve({ a: 0 });
    const ep = defineEndpoint(({ zod }) => ({
      method: 'GET',
      path: '/x',
      base: 'cdn',
      response: zod.object({ a: zod.number() }),
      map,
      staleTime: 10_000,
      middleware: [],
      preRequest,
    }));
    expect(ep.config.base).toBe('cdn');
    expect(ep.config.map).toBe(map);
    expect(ep.config.staleTime).toBe(10_000);
    expect(ep.config.middleware).toEqual([]);
    expect(ep.config.preRequest).toBe(preRequest);
  });

  it('factory receives utils with es-toolkit functions (delay, chunk, etc.)', () => {
    let receivedUtils: EndpointTools['utils'] | undefined;
    defineEndpoint(({ zod, utils }) => {
      receivedUtils = utils;
      return { method: 'GET', path: '/x', response: zod.any() };
    });
    expect(receivedUtils).toBeDefined();
    expect(typeof receivedUtils?.delay).toBe('function');
    expect(typeof receivedUtils?.chunk).toBe('function');
    expect(typeof receivedUtils?.groupBy).toBe('function');
  });

  it('factory receives zod with omnifield extensions (zod.object works)', () => {
    let receivedZod: EndpointTools['zod'] | undefined;
    defineEndpoint(({ zod }) => {
      receivedZod = zod;
      return {
        method: 'GET',
        path: '/x',
        request: zod.object({ id: zod.string() }),
        response: zod.any(),
      };
    });
    expect(receivedZod).toBeDefined();
    expect(typeof receivedZod?.object).toBe('function');
    expect(typeof receivedZod?.string).toBe('function');
  });
});

describe('defineEndpoint — type inference', () => {
  it('InferInput uses request-schema OUTPUT (after parse)', () => {
    const ep = defineEndpoint(({ zod }) => ({
      method: 'GET',
      path: '/x',
      request: zod.object({ id: zod.string() }),
      response: zod.any(),
    }));
    type I = InferInput<typeof ep>;
    expectTypeOf<I>().toEqualTypeOf<{ id: string }>();
  });

  it('InferOutput defaults to response-schema OUTPUT when no map', () => {
    const ep = defineEndpoint(({ zod }) => ({
      method: 'GET',
      path: '/x',
      response: zod.object({ email: zod.string() }),
    }));
    type O = InferOutput<typeof ep>;
    expectTypeOf<O>().toEqualTypeOf<{ email: string }>();
  });

  it('InferOutput uses map return type when map is provided', () => {
    const ep = defineEndpoint(({ zod }) => ({
      method: 'GET',
      path: '/x',
      response: zod.object({ createdAt: zod.string() }),
      map: (dto) => ({ createdAt: new Date(dto.createdAt) }),
    }));
    type O = InferOutput<typeof ep>;
    expectTypeOf<O>().toEqualTypeOf<{ createdAt: Date }>();
  });

  it('Endpoint type can be used as a polymorphic key (covers RegistryNode contract)', () => {
    const ep1 = defineEndpoint(({ zod }) => ({ method: 'GET', path: '/x', response: zod.any() }));
    const ep2 = defineEndpoint(({ zod }) => ({
      method: 'POST',
      path: '/y',
      response: zod.any(),
    }));
    const registry: Record<string, Endpoint> = { a: ep1, b: ep2 };
    expect(registry.a.config.method).toBe('GET');
    expect(registry.b.config.method).toBe('POST');
  });

  it('EndpointTools type: zod is OmnifieldZ, utils is typeof Utils', () => {
    // type-level check: factory arg типизирован как EndpointTools
    type Tools = EndpointTools;
    type ZodField = Tools['zod'];
    type UtilsField = Tools['utils'];
    // zod должен иметь .object (стандартный zod-метод)
    expectTypeOf<ZodField['object']>().toBeFunction();
    // utils должен иметь .delay (из es-toolkit)
    expectTypeOf<UtilsField['delay']>().toBeFunction();
  });
});
