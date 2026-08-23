import { GoogleGenerativeAI } from '@google/generative-ai';
import { serverEnv } from '@/lib/env';
import { LLMProvider, LLMRequest, LLMResponse, ProviderCapabilities } from '../types';
import { PromptRenderer } from '../renderer';

export class GeminiProviderAdapter implements LLMProvider {
  public id = 'gemini';

  public validateCapabilities(capabilities: ProviderCapabilities): boolean {
    // Gemini supports streaming and reasoning; vision is optional
    if (capabilities.supportsReasoning) {
      //gemini-1.5-flash or similar supports reasoning
      return true;
    }
    return true;
  }

  public async generate(request: LLMRequest): Promise<LLMResponse> {
    const apiKey = serverEnv.GEMINI_API_KEY || '';
    if (!apiKey || apiKey === 'MOCK_KEY') {
      throw new Error('Gemini API key is missing or invalid (auth error).');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = request.model || (request.promptPackage?.providerHints?.supportsReasoning ? 'gemini-1.5-pro' : 'gemini-1.5-flash');

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? 250
      }
    });

    const promptText = PromptRenderer.renderToText(request.promptPackage);
    console.log("========== PROMPT SENT TO GEMINI ==========");
    console.log(promptText);
    console.log("===========================================");
    const response = await model.generateContent(promptText);
    const text = response.response.text().trim();

    return {
      text,
      finishReason: 'stop',
      promptTokens: response.response.usageMetadata?.promptTokenCount || Math.ceil(promptText.length / 4),
      completionTokens: response.response.usageMetadata?.candidatesTokenCount || Math.ceil(text.length / 4)
    };
  }

  public async *stream(request: LLMRequest): AsyncGenerator<string, void, unknown> {
    const apiKey = serverEnv.GEMINI_API_KEY || '';
    if (!apiKey || apiKey === 'MOCK_KEY') {
      throw new Error('Gemini API key is missing or invalid (auth error).');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = request.model || (request.promptPackage?.providerHints?.supportsReasoning ? 'gemini-1.5-pro' : 'gemini-1.5-flash');
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? 250
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
