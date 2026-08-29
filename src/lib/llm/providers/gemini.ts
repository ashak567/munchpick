import { GoogleGenerativeAI } from '@google/generative-ai';
import { serverEnv } from '@/lib/env';
import { LLMProvider, LLMRequest, LLMResponse, ProviderCapabilities } from '../types';
import { PromptRenderer } from '../renderer';
import { llmConfig, getApprovedGeminiModel, sanitizeOrValidateModel } from '../config';

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
    const defaultModel = getApprovedGeminiModel('conversational');
    const defaultReasoning = getApprovedGeminiModel('reasoning');
    const supportsReasoning = Boolean(request.promptPackage?.providerHints?.supportsReasoning);
    const fallbackModel = supportsReasoning ? defaultReasoning : defaultModel;
    const modelName = sanitizeOrValidateModel(request.model, fallbackModel);
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
    const result = await model.generateContent(promptText);
    const response = await result.response;
    const text = response.text();

    const candidate = response.candidates?.[0];
    const finishReason = mapGeminiFinishReason(candidate?.finishReason);
    const usage = response.usageMetadata;

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
    const defaultModel = getApprovedGeminiModel('conversational');
    const defaultReasoning = getApprovedGeminiModel('reasoning');
    const supportsReasoning = Boolean(request.promptPackage?.providerHints?.supportsReasoning);
    const fallbackModel = supportsReasoning ? defaultReasoning : defaultModel;
    const modelName = sanitizeOrValidateModel(request.model, fallbackModel);
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
