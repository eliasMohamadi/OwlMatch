import type { z } from 'zod';
import { config, isAiConfigured } from '../config';

/**
 * Thin Gemini REST client. The API key never leaves the server. Every call
 * asks for JSON, enforces a timeout, and validates the result with zod, so
 * callers receive either typed data or an explicit failure to fall back from.
 */
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export type GeminiResult<T> = { ok: true; data: T } | { ok: false; reason: string };

interface GeminiResponseBody {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}

interface ModelListBody {
  models?: { name?: string; supportedGenerationMethods?: string[] }[];
}

/** The model in use. Starts as GEMINI_MODEL and changes only if that model no longer exists. */
let activeModel: string = config.gemini.model;

/**
 * Ask for low "thinking" effort: our tasks are short structured rewrites, and default
 * thinking measured ~17 s vs ~9 s per ranking call. Models that reject the setting
 * (HTTP 400 naming it) are retried once without it, and it stays off from then on.
 */
let useLowThinking = true;

/**
 * If the configured model was retired (HTTP 404), pick the newest available
 * "flash" model that supports generateContent, so the demo keeps working.
 */
/** Only general-purpose models named like "gemini-3.8-flash": not -lite, -tts, -omni, previews, etc. */
const PLAIN_FLASH_MODEL = /^gemini-\d+(\.\d+)?-flash$/;
const modelVersion = (name: string): number => Number(name.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? 0);

async function replacementModel(): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE}?pageSize=200`, { headers: { 'x-goog-api-key': config.gemini.apiKey } });
    if (!response.ok) return null;
    const { models = [] } = (await response.json()) as ModelListBody;
    const candidates = models
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => (m.name ?? '').replace(/^models\//, ''))
      .filter((name) => PLAIN_FLASH_MODEL.test(name))
      .sort((a, b) => modelVersion(b) - modelVersion(a));
    return candidates[0] ?? null;
  } catch {
    return null;
  }
}

export function currentModel(): string {
  return activeModel;
}

export async function generateJson<T>(
  prompt: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  options: { temperature?: number } = {},
): Promise<GeminiResult<T>> {
  if (!isAiConfigured()) return { ok: false, reason: 'Gemini API key not configured' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.gemini.timeoutMs);
  try {
    const response = await fetch(`${API_BASE}/${activeModel}:generateContent`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.gemini.apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: options.temperature ?? 0.4,
          ...(useLowThinking ? { thinkingConfig: { thinkingLevel: 'low' } } : {}),
        },
      }),
    });
    const body = (await response.json()) as GeminiResponseBody;
    if (response.status === 404 && activeModel === config.gemini.model) {
      const replacement = await replacementModel();
      if (replacement && replacement !== activeModel) {
        console.warn(`[ai] model ${activeModel} unavailable; switching to ${replacement}`);
        activeModel = replacement;
        return generateJson(prompt, schema, options);
      }
    }
    if (response.status === 400 && useLowThinking && /thinking/i.test(body.error?.message ?? '')) {
      console.warn(`[ai] model ${activeModel} rejected thinkingLevel; retrying without it`);
      useLowThinking = false;
      return generateJson(prompt, schema, options);
    }
    if (!response.ok) return { ok: false, reason: `Gemini HTTP ${response.status}: ${body.error?.message ?? 'unknown error'}` };

    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, reason: 'Gemini returned non-JSON output' };
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) return { ok: false, reason: `Gemini output failed validation: ${parsed.error.issues[0]?.message}` };
    return { ok: true, data: parsed.data };
  } catch (error) {
    const reason = error instanceof Error && error.name === 'AbortError' ? 'Gemini timed out' : 'Gemini request failed';
    return { ok: false, reason };
  } finally {
    clearTimeout(timer);
  }
}
