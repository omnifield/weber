import { describe, expect, it, vi } from 'vitest';
import { type ApiContext, compose, type Middleware } from '../pipeline';

// Koa-style compose: каждый mw оборачивает следующий через next().
// Тесты держат семантику: порядок pre/post-фаз, передача ctx, защиту
// от двойного next(), short-circuit при не-вызове next().

const mkCtx = (): ApiContext => ({
  endpointName: 'test',
  config: { method: 'GET', path: '/' } as any,
  client: {} as any,
  input: undefined,
  request: { method: 'GET' },
  meta: {},
});

describe('compose — execution order', () => {
  it('runs mw left-to-right pre, right-to-left post', async () => {
    const trace: string[] = [];
    const mk =
      (name: string): Middleware =>
      async (_ctx, next) => {
        trace.push(`pre:${name}`);
        await next();
        trace.push(`post:${name}`);
      };
    await compose([mk('A'), mk('B'), mk('C')])(mkCtx());
    expect(trace).toEqual(['pre:A', 'pre:B', 'pre:C', 'post:C', 'post:B', 'post:A']);
  });

  it('passes the same ctx instance to every mw', async () => {
    const ctx = mkCtx();
    const seen: ApiContext[] = [];
    const mk = (): Middleware => async (c, next) => {
      seen.push(c);
      await next();
    };
    await compose([mk(), mk(), mk()])(ctx);
    expect(seen.every((c) => c === ctx)).toBe(true);
  });

  it('post-phase sees mutations from inner mw', async () => {
    const ctx = mkCtx();
    const log: string[] = [];
    const outer: Middleware = async (c, next) => {
      await next();
      log.push(`outer-sees:${c.meta.tag}`);
    };
    const inner: Middleware = async (c, next) => {
      c.meta.tag = 'set-by-inner';
      await next();
    };
    await compose([outer, inner])(ctx);
    expect(log).toEqual(['outer-sees:set-by-inner']);
  });
});

describe('compose — control flow', () => {
  it('short-circuits if next() not called (post-phases skipped)', async () => {
    const post = vi.fn();
    const stopping: Middleware = async () => {
      /* no next() */
    };
    const tail: Middleware = async (_c, next) => {
      await next();
      post();
    };
    await compose([tail, stopping])(mkCtx());
    expect(post).toHaveBeenCalledOnce(); // outer's post still fires
  });

  it('throws on double next() in single mw', async () => {
    const bad: Middleware = async (_c, next) => {
      await next();
      await next();
    };
    await expect(compose([bad])(mkCtx())).rejects.toThrow(/next\(\) called multiple times/);
  });

  it('empty mw-array resolves cleanly', async () => {
    await expect(compose([])(mkCtx())).resolves.toBeUndefined();
  });

  it('exception in mw propagates out of compose', async () => {
    const boom: Middleware = async () => {
      throw new Error('boom');
    };
    await expect(compose([boom])(mkCtx())).rejects.toThrow('boom');
  });

  it('exception is catchable by outer mw via try/await next()', async () => {
    const catcher = vi.fn();
    const outer: Middleware = async (_c, next) => {
      try {
        await next();
      } catch (e) {
        catcher(e);
      }
    };
    const inner: Middleware = async () => {
      throw new Error('inner');
    };
    await compose([outer, inner])(mkCtx());
    expect(catcher).toHaveBeenCalledWith(expect.any(Error));
  });
});
