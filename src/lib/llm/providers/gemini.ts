import { GoogleGenerativeAI } from '@google/generative-ai';
import { serverEnv } from '@/lib/env';
import { LLMProvider, LLMRequest, LLMResponse, ProviderCapabilities } from '../types';
import { PromptRenderer } from '../renderer';
import { llmConfig } from '../config';

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
    const modelName = request.model || (request.promptPackage?.providerHints?.supportsReasoning ? defaultReasoning : defaultModel);

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: request.temperature ?? config?.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? config?.maxTokens ?? 250
      }
    });

    const promptText = PromptRenderer.renderToText(request.promptPackage);
    const startTime = Date.now();
    console.log(`[GeminiAdapter] Request Started (model=${modelName}, promptLength=${promptText.length})`);
    
    const response = await model.generateContent(promptText);
    const latency = Date.now() - startTime;
    console.log(`[GeminiAdapter] Request Completed (model=${modelName}, latency=${latency}ms)`);
    const text = response.response.text().trim();

    return {
      text,
      finishReason: 'stop',
      promptTokens: response.response.usageMetadata?.promptTokenCount || Math.ceil(promptText.length / 4),
      completionTokens: response.response.usageMetadata?.candidatesTokenCount || Math.ceil(text.length / 4)
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
    const modelName = request.model || (request.promptPackage?.providerHints?.supportsReasoning ? defaultReasoning : defaultModel);
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: request.temperature ?? config?.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? config?.maxTokens ?? 250
      }
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
