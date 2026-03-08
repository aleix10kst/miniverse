/**
 * LLM wrapper using fal.ai's any-llm endpoint.
 * Same FAL_KEY as image generation — no extra config needed.
 */

import { fal } from '@fal-ai/client';

const DEFAULT_MODEL = 'google/gemini-2.5-flash';

export interface LLMOptions {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  imageUrl?: string;
}

export interface LLMResult {
  output: string;
}

/**
 * Call an LLM via fal.ai. Supports text-only or vision (with imageUrl).
 */
export async function llm(options: LLMOptions): Promise<LLMResult> {
  const model = options.model ?? DEFAULT_MODEL;
  const endpoint = options.imageUrl ? 'fal-ai/any-llm/vision' : 'fal-ai/any-llm';

  const input: Record<string, unknown> = {
    model,
    prompt: options.prompt,
  };

  if (options.systemPrompt) input.system_prompt = options.systemPrompt;
  if (options.imageUrl) input.image_urls = [options.imageUrl];

  const result = await fal.subscribe(endpoint, { input });
  const data = result.data as { output: string };
  return { output: data.output };
}

/**
 * Call LLM and parse the response as JSON.
 * Strips markdown code fences if present.
 */
export async function llmJSON<T = unknown>(options: LLMOptions, retries = 2): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const result = await llm(options);
    let text = result.output.trim();

    // Strip ```json ... ``` wrapping
    const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenceMatch) text = fenceMatch[1].trim();

    try {
      return JSON.parse(text) as T;
    } catch (e) {
      if (attempt < retries) {
        console.warn(`JSON parse failed (attempt ${attempt + 1}), retrying...`);
        continue;
      }
      throw e;
    }
  }
  throw new Error('Unreachable');
}
