import { createQueryClient, type QueryClient, setQueryClient } from './client';
import type { Endpoint, InferInput, InferOutput } from './endpoint';
import * as builtinMw from './middleware';
import { type ApiContext, compose, type Middleware } from './pipeline';

/**
 * Typed-proxy `services.api` для Feature. Сливается через TS-interface-merging
 * с `apps/<app>/.weber/@types/api.d.ts` (генерируется EndpointsRegistryPlugin'ом
 * из реального `Endpoints`-реестра приложения). Без плагина — пустой interface,
 * что соответствует "API не настроен"-кейсу: TS не пропустит `api.user.get(...)`
 * без декларации эндпоинтов.
 *
 * Раньше декларация жила в `web-core/wrappers/interfaces.ts`. Перенесена сюда
 * — это родной дом `OmnifieldApi`-типа (нужен `getApiClient(): OmnifieldApi`).
 * web-core всё равно видит её через interface-merging, потому что web-core
 * depends on web-query.
 */
declare global {
  interface OmnifieldApi {}
}

/** Карта user-facing middleware-факторий — приходит в `api({ mw })`-callback. */
export type MwToolbox = {
  cookies: typeof builtinMw.cookies;
  auth: typeof builtinMw.auth;
  statusMapper: typeof builtinMw.statusMapper;
  on401: typeof builtinMw.on401;
  log: typeof builtinMw.log;
  retry: typeof builtinMw.retry;
};

const mw: MwToolbox = {
  cookies: builtinMw.cookies,
  auth: builtinMw.auth,
  statusMapper: builtinMw.statusMapper,
  on401: builtinMw.on401,
  log: builtinMw.log,
  retry: builtinMw.retry,
};

/** Конфиг API — кладётся в `IAppConfig.api` (`weber.app.ts`). */
export interface ApiConfig {
  bases?: Record<string, string>;
  defaultHeaders?: Record<string, string>;
  defaultStaleTime?: number;
  middleware?: ReadonlyArray<Middleware>;
}

/** Либо литерал, либо фабрика — фабрика получает `{ mw }` toolbox. */
export type ApiConfigInput = ApiConfig | ((ctx: { mw: MwToolbox }) => ApiConfig);

/** Узел реестра — либо endpoint, либо вложенный namespace. */
export type RegistryNode = Endpoint | { [k: string]: RegistryNode };

/** Корневой реестр — обычно собирается через `import * as user from './user'`. */
export type EndpointsRegistry = Record<string, RegistryNode>;

/** Тип итогового typed-proxy: листья → callable `(input) => Promise<output>`. */
export type InferApi<R extends EndpointsRegistry> = {
  [K in keyof R]: R[K] extends Endpoint
    ? (input: InferInput<R[K]>) => Promise<InferOutput<R[K]>>
    : R[K] extends Record<string, RegistryNode>
      ? InferApi<R[K] & EndpointsRegistry>
      : never;
};

const isEndpoint = (n: RegistryNode): n is Endpoint =>
  typeof n === 'object' && n !== null && 'config' in n;

const resolveConfig = (input: ApiConfigInput): ApiConfig =>
  typeof input === 'function' ? input({ mw }) : input;

const wrapEndpoint = (
  endpoint: Endpoint,
  qualifiedName: string,
  client: QueryClient,
  globalMw: ReadonlyArray<Middleware>,
) => {
  const pipeline = compose<ApiContext>([
    builtinMw.validateInput(),
    // preRequest — typed-сахар между validateInput (input уже zod-parsed)
    // и buildRequest (URL ещё не собран). resolve(data) короткозамыкает
    // pipeline (buildRequest/httpTransport/validateResponse/mapDomain skip).
    builtinMw.preRequestHook(),
    builtinMw.buildRequest(),
    ...globalMw,
    builtinMw.httpTransport(),
    builtinMw.validateResponse(),
    builtinMw.mapDomain(),
    ...(endpoint.config.middleware ?? []),
  ]);

  return async (input: unknown) => {
    const ctx: ApiContext = {
      endpointName: qualifiedName,
      config: endpoint.config,
      client,
      input,
      // Заполняется `buildRequest`'ом — placeholder чтобы TS не ругался.
      request: { method: endpoint.config.method },
      meta: {},
    };
    await pipeline(ctx);
    return ctx.data;
  };
};

const buildNode = (
  node: RegistryNode,
  path: ReadonlyArray<string>,
  client: QueryClient,
  globalMw: ReadonlyArray<Middleware>,
): unknown => {
  if (isEndpoint(node)) return wrapEndpoint(node, path.join('.'), client, globalMw);
  const out: Record<string, unknown> = {};
  for (const [k, child] of Object.entries(node)) {
    out[k] = buildNode(child, [...path, k], client, globalMw);
  }
  return out;
};

/**
 * Статическая сборка typed-API из реестра endpoints + конфига.
 *
 * ```ts
 * const api = createApi(
 *   ({ mw }) => ({
 *     bases: { default: '/api' },
 *     middleware: [mw.cookies(), mw.statusMapper(), mw.log()],
 *   }),
 *   { user, chat },
 * );
 * await api.user.get({ id: '1' }); // → User
 * ```
 *
 * Каждый endpoint получает свою pre-composed pipeline один раз при сборке;
 * вызов — это уже линейный прогон без anyого build-оверхеда.
 */
export const createApi = <R extends EndpointsRegistry>(
  configInput: ApiConfigInput,
  endpoints: R,
): InferApi<R> => {
  const cfg = resolveConfig(configInput);
  const client = createQueryClient({
    bases: cfg.bases,
    defaultHeaders: cfg.defaultHeaders,
    defaultStaleTime: cfg.defaultStaleTime,
  });
  // Публикуем client в module-singleton, чтобы `getQueryClient()` возвращал
  // **тот же** клиент, который использует pipeline. Без этого getter всегда
  // отдавал `undefined`, и доступ к cache-API (invalidate, setQueryData) был
  // возможен только через прямые вызовы — недоступные из Feature.
  setQueryClient(client);
  const globalMw = cfg.middleware ?? [];
  return buildNode(endpoints, [], client, globalMw) as InferApi<R>;
};

// Module-level singleton — выставляется в generated `app-config.gen.ts` через
// `setApiClient(createApi(appConfig.api, endpoints))`. Per-app: каждый bundle
// имеет свой module-graph → свой singleton (изоляция между apps в одном процессе
// гарантируется build-time изоляцией).
let _api: unknown;

/**
 * Bootstrap-helper: вызывается из generated `app-config.gen.ts`. Принимает
 * `unknown` (а не `OmnifieldApi`), потому что результат `createApi()` —
 * runtime-собранный proxy с реальной структурой, выводимой только из
 * generated `Endpoints` типа в app-уровне.
 */
export const setApiClient = (api: unknown): void => {
  _api = api;
};

/**
 * Используется `createLogicWrapper` для инжекта `services.api` в Feature.
 *
 * Возвращает глобальный `OmnifieldApi` (interface-merged через
 * `apps/<app>/.weber/@types/api.d.ts` плагином `EndpointsRegistryPlugin`).
 * До инициализации (`setApiClient(...)` ещё не вызывался) — `undefined`.
 *
 * Без EndpointsRegistryPlugin'а `OmnifieldApi` — пустой `interface {}`, что
 * соответствует "API не настроен"-кейсу: TS не врёт, дёргать `api.user.get`
 * без декларации эндпоинтов невозможно.
 */
export const getApiClient = (): OmnifieldApi | undefined => _api as OmnifieldApi | undefined;
