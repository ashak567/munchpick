import { serverEnv } from '@/lib/env';
import { LLMProvider, LLMRequest, LLMResponse, ProviderCapabilities } from '../types';
import { PromptRenderer } from '../renderer';
import { llmConfig } from '../config';

export class AnthropicProviderAdapter implements LLMProvider {
  public id = 'anthropic';

  public validateCapabilities(capabilities: ProviderCapabilities): boolean {
    // Anthropic (Claude 3.5/3.7) supports streaming, reasoning, and vision
    return true;
  }

  public isConfigured(): boolean {
    const apiKey = serverEnv?.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '';
    return Boolean(apiKey && apiKey !== 'MOCK_KEY');
  }

  public async generate(request: LLMRequest): Promise<LLMResponse> {
    const apiKey = serverEnv?.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '';
    if (!apiKey || apiKey === 'MOCK_KEY') {
      throw new Error('Anthropic API key is missing or invalid (auth error).');
    }

    const config = llmConfig.providers.anthropic || llmConfig.providers.claude;
    const modelName = request.model || (
      request.promptPackage?.providerHints?.supportsReasoning
        ? (config?.reasoningModel || 'claude-3-7-sonnet-20250219')
        : (config?.model || 'claude-3-5-sonnet-20241022')
    );

    const promptText = PromptRenderer.renderToText(request.promptPackage);
    const maxTokens = request.maxTokens ?? config?.maxTokens ?? 250;
    const temperature = request.temperature ?? config?.temperature ?? 0.7;

    const startTime = Date.now();
    console.log(`[AnthropicAdapter] Request Started (model=${modelName}, promptLength=${promptText.length})`);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: maxTokens,
        temperature,
        messages: [
          {
            role: 'user',
            content: promptText
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      const latency = Date.now() - startTime;
      console.warn(`[AnthropicAdapter] Request Failed (model=${modelName}, status=${response.status}, latency=${latency}ms)`);
      if (response.status === 401 || response.status === 403) {
        throw new Error('Anthropic API key is missing or invalid (auth error).');
      }
      if (response.status === 429) {
        throw new Error('Anthropic rate limit reached.');
      }
      throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
    }

    const latency = Date.now() - startTime;
    console.log(`[AnthropicAdapter] Request Completed (model=${modelName}, latency=${latency}ms)`);

    const data = await response.json();
    const text = (data.content || [])
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('')
      .trim();

    const stopReason = data.stop_reason === 'end_turn' || data.stop_reason === 'stop_sequence'
      ? 'stop'
      : (data.stop_reason || 'stop');

    return {
      text,
      finishReason: stopReason,
      promptTokens: data.usage?.input_tokens || Math.ceil(promptText.length / 4),
      completionTokens: data.usage?.output_tokens || Math.ceil(text.length / 4)
    };
  }

  public async *stream(request: LLMRequest): AsyncGenerator<string, void, unknown> {
    const apiKey = serverEnv?.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '';
    if (!apiKey || apiKey === 'MOCK_KEY') {
      throw new Error('Anthropic API key is missing or invalid (auth error).');
    }

    const config = llmConfig.providers.anthropic || llmConfig.providers.claude;
    const modelName = request.model || (
      request.promptPackage?.providerHints?.supportsReasoning
        ? (config?.reasoningModel || 'claude-3-7-sonnet-20250219')
        : (config?.model || 'claude-3-5-sonnet-20241022')
    );

    const promptText = PromptRenderer.renderToText(request.promptPackage);
    const maxTokens = request.maxTokens ?? config?.maxTokens ?? 250;
    const temperature = request.temperature ?? config?.temperature ?? 0.7;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: maxTokens,
        temperature,
        stream: true,
        messages: [
          {
            role: 'user',
            content: promptText
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401 || response.status === 403) {
        throw new Error('Anthropic API key is missing or invalid (auth error).');
      }
      if (response.status === 429) {
        throw new Error('Anthropic rate limit reached.');
      }
      throw new Error(`Anthropic API streaming error (${response.status}): ${errorText}`);
    }

    if (!response.body) {
      throw new Error('Anthropic streaming response body is missing.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6);
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              yield parsed.delta.text;
            }
          } catch {
            // Ignore partial/unparseable JSON lines
          }
        }
      }
    }
  }
}
