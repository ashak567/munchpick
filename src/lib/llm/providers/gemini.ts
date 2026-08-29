import { GoogleGenerativeAI } from '@google/generative-ai';
import { serverEnv } from '@/lib/env';
import { LLMProvider, LLMRequest, LLMResponse, ProviderCapabilities } from '../types';
import { PromptRenderer } from '../renderer';
import { llmConfig } from '../config';

function mapGeminiFinishReason(reason?: string): 'stop' | 'length' | 'content_filter' | 'other' {
  switch (reason) {
    case 'STOP':
      return 'stop';
    case 'MAX_TOKENS':
      return 'length';
    case 'SAFETY':
    case 'RECITATION':
      return 'content_filter';
    default:
      return 'stop';
  }
}

export class GeminiProviderAdapter implements LLMProvider {
  public id = 'gemini';

  public validateCapabilities(capabilities: ProviderCapabilities): boolean {
    // Gemini supports streaming and reasoning; vision is optional
    if (capabilities.supportsReasoning) {
      return true;
    }
    return true;
  }

  public isConfigured(): boolean {
    const apiKey = serverEnv?.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
    return Boolean(apiKey && apiKey !== 'MOCK_KEY');
  }

  public async generate(request: LLMRequest): Promise<LLMResponse> {
    const apiKey = serverEnv?.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
    if (!apiKey || apiKey === 'MOCK_KEY') {
      throw new Error('Gemini API key is missing or invalid (auth error).');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const config = llmConfig.providers.gemini;
    const defaultModel = config?.model || 'gemini-2.5-flash';
    const defaultReasoning = config?.reasoningModel || defaultModel;
    const supportsReasoning = Boolean(request.promptPackage?.providerHints?.supportsReasoning);
    const modelName = request.model || (supportsReasoning ? defaultReasoning : defaultModel);
    const maxTokens = request.maxTokens ?? config?.maxTokens ?? (supportsReasoning ? 1500 : 800);

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: request.temperature ?? config?.temperature ?? 0.7,
        maxOutputTokens: maxTokens,
        thinkingConfig: {
          thinkingBudget: supportsReasoning ? 500 : 0
        }
      } as any
    });

    const promptText = PromptRenderer.renderToText(request.promptPackage);
    const startTime = Date.now();
    console.log(`[GeminiAdapter] Request Started (model=${modelName}, promptLength=${promptText.length}, maxTokens=${maxTokens})`);
    
    const response = await model.generateContent(promptText);
    const latency = Date.now() - startTime;
    console.log(`[GeminiAdapter] Request Completed (model=${modelName}, latency=${latency}ms)`);
    const text = response.response.text().trim();
    const candidate = response.response.candidates?.[0];
    const rawFinishReason = candidate?.finishReason;
    const finishReason = mapGeminiFinishReason(rawFinishReason);
    const usage = response.response.usageMetadata;

    if (rawFinishReason === 'MAX_TOKENS') {
      console.warn(
        `[GeminiAdapter] Warning: response reached MAX_TOKENS limit (promptTokens=${usage?.promptTokenCount}, candidateTokens=${usage?.candidatesTokenCount}, thoughtsTokens=${(usage as any)?.thoughtsTokenCount || 0})`
      );
    }

    return {
      text,
      finishReason,
      promptTokens: usage?.promptTokenCount || Math.ceil(promptText.length / 4),
      completionTokens: usage?.candidatesTokenCount || Math.ceil(text.length / 4)
    };
  }

  public async *stream(request: LLMRequest): AsyncGenerator<string, void, unknown> {
    const apiKey = serverEnv?.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
    if (!apiKey || apiKey === 'MOCK_KEY') {
      throw new Error('Gemini API key is missing or invalid (auth error).');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const config = llmConfig.providers.gemini;
    const defaultModel = config?.model || 'gemini-2.5-flash';
    const defaultReasoning = config?.reasoningModel || defaultModel;
    const supportsReasoning = Boolean(request.promptPackage?.providerHints?.supportsReasoning);
    const modelName = request.model || (supportsReasoning ? defaultReasoning : defaultModel);
    const maxTokens = request.maxTokens ?? config?.maxTokens ?? (supportsReasoning ? 1500 : 800);

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: request.temperature ?? config?.temperature ?? 0.7,
        maxOutputTokens: maxTokens,
        thinkingConfig: {
          thinkingBudget: supportsReasoning ? 500 : 0
        }
      } as any
    });

    const promptText = PromptRenderer.renderToText(request.promptPackage);
    const responseStream = await model.generateContentStream(promptText);
    for await (const chunk of responseStream.stream) {
      const text = chunk.text();
      if (text) {
        yield text;
      }
    }
  }
}
