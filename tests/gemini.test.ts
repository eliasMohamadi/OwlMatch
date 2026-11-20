import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

/** The Gemini client against a stubbed network: no key or internet needed. */
const schema = z.object({ answer: z.string() });
let generateJson: typeof import('../server/ai/gemini').generateJson;
let currentModel: typeof import('../server/ai/gemini').currentModel;

const geminiReply = (text: string) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });

beforeAll(async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_MODEL = 'gemini-retired-flash';
  ({ generateJson, currentModel } = await import('../server/ai/gemini'));
});

afterEach(() => vi.unstubAllGlobals());

describe('generateJson', () => {
  it('switches to an available flash model when the configured one is retired', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'not found' } }), { status: 404 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            models: [
              { name: 'models/gemini-9-flash', supportedGenerationMethods: ['generateContent'] },
              { name: 'models/gemini-9-flash-tts', supportedGenerationMethods: ['generateContent'] },
              { name: 'models/text-embedding-9', supportedGenerationMethods: ['embedContent'] },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(geminiReply('{"answer":"hi"}'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateJson('prompt', schema);
    expect(result).toEqual({ ok: true, data: { answer: 'hi' } });
    expect(currentModel()).toBe('gemini-9-flash');
    expect(String(fetchMock.mock.calls[2][0])).toContain('gemini-9-flash:generateContent');
    // The key travels in a header, never in the URL.
    expect(String(fetchMock.mock.calls[2][0])).not.toContain('test-key');
  });

  it('rejects non-JSON output', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(geminiReply('Sure! Here are some events...')));
    expect(await generateJson('prompt', schema)).toEqual({ ok: false, reason: 'Gemini returned non-JSON output' });
  });

  it('rejects JSON that does not match the schema', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(geminiReply('{"answer": 42}')));
    const result = await generateJson('prompt', schema);
    expect(result.ok).toBe(false);
  });

  it('reports network failures instead of throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));
    expect(await generateJson('prompt', schema)).toEqual({ ok: false, reason: 'Gemini request failed' });
  });
});
