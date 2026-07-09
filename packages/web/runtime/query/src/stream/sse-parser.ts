/**
 * Generic SSE-парсер поверх `ReadableStream<Uint8Array>`.
 *
 * Браузерный `EventSource` не подходит для стримингового POST: он работает
 * только с GET и не поддерживает тело. Вместо этого используем `fetch()` +
 * `ReadableStream`.
 *
 * Формат SSE (RFC 9400 / EventSource):
 *   event: <name>\n
 *   data: <text>\n
 *   \n
 *
 * Кадры разделены пустой строкой (`\n\n`). Частичные чанки буферизуются
 * между итерациями читателя.
 *
 * @module
 */

/** Один разобранный SSE-кадр. */
export interface SseFrame {
  /** Имя события (`event:` поле). По умолчанию `'message'` если поле отсутствует. */
  event: string;
  /** Сырое значение `data:` поля (одна или несколько строк, объединённых через `\n`). */
  data: string;
}

/**
 * Читает `ReadableStream<Uint8Array>` и последовательно yield'ит разобранные
 * SSE-кадры.
 *
 * - Корректно обрабатывает частичные чанки на границах буфера.
 * - Игнорирует комментарии (строки начинающиеся с `:`).
 * - Пропускает пустые кадры (нет `data:`).
 * - Делает `reader.releaseLock()` в `finally` — безопасен при `break` и при
 *   ошибках выше по стеку.
 *
 * @example
 * ```ts
 * const res = await fetch('/api/stream', { method: 'POST', body: JSON.stringify(input) });
 * for await (const frame of parseSseStream(res.body!)) {
 *   console.log(frame.event, frame.data);
 * }
 * ```
 */
export async function* parseSseStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<SseFrame> {
  const decoder = new TextDecoder();
  let buffer = '';

  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Кадры разделены \n\n
      const frames = buffer.split('\n\n');
      // Последний элемент — незавершённый кадр (или пустая строка после финального \n\n)
      buffer = frames.pop() ?? '';

      for (const frame of frames) {
        const parsed = parseSseFrame(frame);
        if (parsed !== null) {
          yield parsed;
        }
      }
    }

    // Flush остатка (если поток завершился без финального \n\n)
    if (buffer.trim().length > 0) {
      const parsed = parseSseFrame(buffer);
      if (parsed !== null) {
        yield parsed;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Разбирает один SSE-кадр (набор строк вида `field: value`).
 * Возвращает `null` если кадр пустой или не содержит `data:`.
 */
export function parseSseFrame(frame: string): SseFrame | null {
  let event = 'message';
  let data = '';

  for (const line of frame.split('\n')) {
    // Комментарий SSE — игнорируем
    if (line.startsWith(':')) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const field = line.slice(0, colonIdx).trim();
    // Значение: одиночный пробел после ':' опционален по spec
    const value = line.slice(colonIdx + 1).replace(/^ /, '');

    if (field === 'event') {
      event = value;
    } else if (field === 'data') {
      // Многострочные data: объединяются через '\n'
      data += data.length > 0 ? '\n' + value : value;
    }
    // id и retry — не используем
  }

  if (data.length === 0) return null;
  return { event, data };
}
