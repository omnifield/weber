import { describe, expect, it } from 'vitest';
import { parseSseFrame, parseSseStream } from '../sse-parser';

// ─── Хелперы ─────────────────────────────────────────────────────────────────

function stringToStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

/** Разбить строку на чанки фиксированного размера — имитирует частичные кадры. */
function chunkedStream(text: string, chunkSize: number): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  return new ReadableStream({
    start(controller) {
      let offset = 0;
      while (offset < bytes.length) {
        controller.enqueue(bytes.slice(offset, offset + chunkSize));
        offset += chunkSize;
      }
      controller.close();
    },
  });
}

async function collectFrames(stream: ReadableStream<Uint8Array>) {
  const frames: Array<{ event: string; data: string }> = [];
  for await (const frame of parseSseStream(stream)) {
    frames.push(frame);
  }
  return frames;
}

// ─── parseSseFrame (unit) ─────────────────────────────────────────────────────

describe('parseSseFrame', () => {
  it('разбирает кадр с event + data', () => {
    const frame = parseSseFrame('event: token\ndata: hello');
    expect(frame).toEqual({ event: 'token', data: 'hello' });
  });

  it('дефолтное event = "message" если поле отсутствует', () => {
    const frame = parseSseFrame('data: world');
    expect(frame).toEqual({ event: 'message', data: 'world' });
  });

  it('возвращает null для пустого кадра', () => {
    expect(parseSseFrame('')).toBeNull();
  });

  it('возвращает null если нет data', () => {
    expect(parseSseFrame('event: ping')).toBeNull();
  });

  it('игнорирует комментарии (строки начинающиеся с :)', () => {
    const frame = parseSseFrame(': keep-alive\nevent: token\ndata: x');
    expect(frame).toEqual({ event: 'token', data: 'x' });
  });

  it('объединяет несколько data-строк через \\n', () => {
    const frame = parseSseFrame('data: line1\ndata: line2');
    expect(frame).toEqual({ event: 'message', data: 'line1\nline2' });
  });

  it('пробел после ":" опционален — оба варианта работают', () => {
    const withSpace = parseSseFrame('event: token\ndata: hello');
    const withoutSpace = parseSseFrame('event:token\ndata:hello');
    expect(withSpace).toEqual({ event: 'token', data: 'hello' });
    expect(withoutSpace).toEqual({ event: 'token', data: 'hello' });
  });
});

// ─── parseSseStream (integration) ────────────────────────────────────────────

describe('parseSseStream', () => {
  it('разбирает один кадр token', async () => {
    const sse = 'event: token\ndata: {"type":"token","content":"Hello"}\n\n';
    const frames = await collectFrames(stringToStream(sse));

    expect(frames).toHaveLength(1);
    expect(frames[0].event).toBe('token');
    expect(JSON.parse(frames[0].data)).toEqual({ type: 'token', content: 'Hello' });
  });

  it('разбирает последовательность token→token→done', async () => {
    const sse = [
      'event: token\ndata: {"type":"token","content":"Hi"}\n\n',
      'event: token\ndata: {"type":"token","content":" there"}\n\n',
      'event: done\ndata: {"type":"done","content":"Hi there"}\n\n',
    ].join('');

    const frames = await collectFrames(stringToStream(sse));

    expect(frames).toHaveLength(3);
    expect(frames[0].event).toBe('token');
    expect(frames[1].event).toBe('token');
    expect(frames[2].event).toBe('done');
    expect(JSON.parse(frames[2].data)).toMatchObject({ type: 'done', content: 'Hi there' });
  });

  it('разбирает кадр tool_call', async () => {
    const call = {
      type: 'tool_call',
      call: { id: 'c1', name: 'search', arguments: { q: 'hello' } },
    };
    const sse = `event: tool_call\ndata: ${JSON.stringify(call)}\n\n`;
    const frames = await collectFrames(stringToStream(sse));

    expect(frames).toHaveLength(1);
    expect(frames[0].event).toBe('tool_call');
    expect(JSON.parse(frames[0].data)).toEqual(call);
  });

  it('разбирает кадр error', async () => {
    const sse = 'event: error\ndata: {"type":"error","message":"oops"}\n\n';
    const frames = await collectFrames(stringToStream(sse));

    expect(frames).toHaveLength(1);
    expect(frames[0].event).toBe('error');
    expect(JSON.parse(frames[0].data)).toEqual({ type: 'error', message: 'oops' });
  });

  it('корректно обрабатывает частичные чанки на границе буфера (chunkSize=5)', async () => {
    const sse = [
      'event: token\ndata: {"type":"token","content":"A"}\n\n',
      'event: done\ndata: {"type":"done","content":"A"}\n\n',
    ].join('');

    const frames = await collectFrames(chunkedStream(sse, 5));

    expect(frames).toHaveLength(2);
    expect(frames[0].event).toBe('token');
    expect(frames[1].event).toBe('done');
  });

  it('корректно обрабатывает частичные чанки размером 1 байт', async () => {
    const sse = 'event: token\ndata: {"type":"token","content":"X"}\n\n';
    const frames = await collectFrames(chunkedStream(sse, 1));

    expect(frames).toHaveLength(1);
    expect(JSON.parse(frames[0].data)).toMatchObject({ content: 'X' });
  });

  it('игнорирует SSE-комментарии (строки начинающиеся с :)', async () => {
    const sse = ': keep-alive\nevent: token\ndata: {"type":"token","content":"Z"}\n\n';
    const frames = await collectFrames(stringToStream(sse));

    expect(frames).toHaveLength(1);
    expect(frames[0].event).toBe('token');
  });

  it('игнорирует пустые кадры (двойные \\n\\n)', async () => {
    const sse = '\n\nevent: token\ndata: {"type":"token","content":"W"}\n\n\n\n';
    const frames = await collectFrames(stringToStream(sse));

    expect(frames).toHaveLength(1);
  });

  it('возвращает пустой массив для пустого стрима', async () => {
    const frames = await collectFrames(stringToStream(''));
    expect(frames).toHaveLength(0);
  });

  it('разбирает кадр done с tool_calls', async () => {
    const chunk = {
      type: 'done',
      content: 'ok',
      tool_calls: [{ id: 't1', name: 'fn', arguments: {} }],
    };
    const sse = `event: done\ndata: ${JSON.stringify(chunk)}\n\n`;
    const frames = await collectFrames(stringToStream(sse));

    expect(frames).toHaveLength(1);
    const parsed = JSON.parse(frames[0].data);
    expect(parsed.tool_calls).toHaveLength(1);
    expect(parsed.tool_calls[0].name).toBe('fn');
  });

  it('разбирает несколько tool_call подряд', async () => {
    const sse = [
      'event: tool_call\ndata: {"type":"tool_call","call":{"id":"1","name":"a","arguments":{}}}\n\n',
      'event: tool_call\ndata: {"type":"tool_call","call":{"id":"2","name":"b","arguments":{}}}\n\n',
      'event: done\ndata: {"type":"done","content":""}\n\n',
    ].join('');
    const frames = await collectFrames(stringToStream(sse));

    expect(frames).toHaveLength(3);
    expect(frames[0].event).toBe('tool_call');
    expect(frames[1].event).toBe('tool_call');
    expect(frames[2].event).toBe('done');
  });

  it('освобождает reader lock после завершения стрима', async () => {
    const sse = 'event: ping\ndata: {}\n\n';
    const stream = stringToStream(sse);
    await collectFrames(stream);
    // reader должен быть отпущен — попытка взять ещё один не должна бросить
    expect(() => stream.getReader()).not.toThrow();
  });

  it('освобождает reader lock при break (ранний выход)', async () => {
    const sse = [
      'event: token\ndata: {"n":1}\n\n',
      'event: token\ndata: {"n":2}\n\n',
      'event: done\ndata: {"n":3}\n\n',
    ].join('');
    const stream = stringToStream(sse);

    // Берём только первый кадр
    const gen = parseSseStream(stream);
    await gen.next();
    await gen.return(undefined); // имитирует break — должен releaseLock

    expect(() => stream.getReader()).not.toThrow();
  });
});
