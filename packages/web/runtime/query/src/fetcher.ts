import { HttpError } from './errors';
import type { Fetcher } from './types';

/**
 * Дефолтный HTTP-fetcher на нативном `fetch`. JSON-сериализует body,
 * JSON-парсит response при `Content-Type: application/json`, иначе отдаёт
 * `text()`/`blob()` в зависимости от типа. Бросает `HttpError` с `.status` и
 * `.response` на non-2xx — `statusMapper` mw конвертит его в типизированные
 * `UnauthorizedError`/`ServerError`/...
 */
export const defaultFetcher: Fetcher = async (req) => {
  const init: RequestInit = {
    method: req.method ?? 'GET',
    headers: req.headers as Record<string, string> | undefined,
    signal: req.signal,
    credentials: req.credentials,
  };

  if (req.body != null) {
    if (typeof req.body === 'string' || req.body instanceof FormData || req.body instanceof Blob) {
      init.body = req.body as BodyInit;
    } else {
      init.body = JSON.stringify(req.body);
      init.headers = { 'Content-Type': 'application/json', ...(init.headers ?? {}) };
    }
  }

  const res = await fetch(req.resolvedUrl, init);

  if (!res.ok) {
    // Прочитываем body до throw'а — стрим живёт один раз; consumer (Sentry /
    // statusMapper / on401-handler) получит детали через HttpError.bodyText.
    // Клонировать дешевле через ветку catch чем держать пару читателей.
    const bodyText = await res.text().catch(() => null);
    throw new HttpError(res.status, res, { bodyText });
  }

  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) return res.json();
  if (ct.includes('text/')) return res.text();
  if (res.status === 204) return undefined;
  return res.blob();
};
