import { GoogleGenerativeAI } from '@google/generative-ai';
import { serverEnv } from '@/lib/env';
import { LLMProvider, LLMRequest, LLMResponse, ProviderCapabilities } from '../types';
import { PromptRenderer } from '../renderer';

export class GeminiProviderAdapter implements LLMProvider {
  public id = 'gemini';

  public validateCapabilities(capabilities: ProviderCapabilities): boolean {
    // Gemini supports streaming and reasoning; vision is optional
    if (capabilities.supportsReasoning) {
      //gemini-2.5-pro or similar supports reasoning
      return true;
    }
    return true;
  }

  public async generate(request: LLMRequest): Promise<LLMResponse> {
    const apiKey = serverEnv.GEMINI_API_KEY || '';
    if (!apiKey || apiKey === 'MOCK_KEY') {
      // Mock response for fallback/no API key environment
      const text = `[Fallback Pandy] I hear how heavy this feels. It's okay to feel this way, and I'm right here with you. What else is on your mind?`;
      return {
        text,
        finishReason: 'stop',
        promptTokens: 10,
        completionTokens: 20
      };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const useReasoning = request.promptPackage.providerHints?.supportsReasoning;
    const modelName = useReasoning ? 'gemini-2.5-pro' : 'gemini-3.5-flash';

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? 250
      }
    });

    const promptText = PromptRenderer.renderToText(request.promptPackage);
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
      yield '[Fallback Pandy] I hear how ';
      yield 'heavy this feels. ';
      yield 'It\'s okay to feel this way.';
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash',
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
