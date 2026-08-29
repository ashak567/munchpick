import { serverEnv } from '@/lib/env';
import { llmConfig } from '../config';
import { PromptRenderer } from '../renderer';
import { LLMProvider, LLMRequest, LLMResponse, ProviderCapabilities } from '../types';

interface OpenAICompatibleOptions {
  id: 'groq' | 'openrouter';
  endpoint: string;
  apiKey: () => string;
}

export class OpenAICompatibleProviderAdapter implements LLMProvider {
  public id: 'groq' | 'openrouter';

  constructor(private readonly options: OpenAICompatibleOptions) {
    this.id = options.id;
  }

  public validateCapabilities(_capabilities: ProviderCapabilities): boolean {
    return true;
  }

  public isConfigured(): boolean {
    const apiKey = this.options.apiKey();
    return Boolean(apiKey && apiKey !== 'MOCK_KEY');
  }

  public async generate(request: LLMRequest): Promise<LLMResponse> {
    const apiKey = this.options.apiKey();
    if (!apiKey || apiKey === 'MOCK_KEY') {
      throw new Error(`${this.id} API key is missing or invalid (auth error).`);
    }

    const config = llmConfig.providers[this.id];
    const model = request.model || config.model;
    const promptText = PromptRenderer.renderToText(request.promptPackage);
    const response = await fetch(this.options.endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: request.temperature ?? config.temperature,
        max_tokens: request.maxTokens ?? config.maxTokens,
        messages: [{ role: 'user', content: promptText }]
      })
    });

    if (!response.ok) {
      const details = await response.text();
      if (response.status === 401 || response.status === 403) {
        throw new Error(`${this.id} API key is missing or invalid (auth error).`);
      }
      if (response.status === 429) {
        throw new Error(`${this.id} rate limit reached.`);
      }
      throw new Error(`${this.id} API error (${response.status}): ${details}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new Error(`${this.id} returned an invalid empty response.`);
    }

    const finishReason = data.choices?.[0]?.finish_reason || 'stop';
    if (finishReason === 'length') {
      console.warn(`[OpenAICompatibleAdapter:${this.id}] Warning: response reached token length limit.`);
    }

    return {
      text,
      finishReason,
      promptTokens: data.usage?.prompt_tokens || Math.ceil(promptText.length / 4),
      completionTokens: data.usage?.completion_tokens || Math.ceil(text.length / 4)
    };
  }

  public async *stream(request: LLMRequest): AsyncGenerator<string, void, unknown> {
    yield (await this.generate(request)).text;
  }
}

export const getGroqApiKey = () => serverEnv?.GROQ_API_KEY || process.env.GROQ_API_KEY || '';
export const getOpenRouterApiKey = () => serverEnv?.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY || '';
