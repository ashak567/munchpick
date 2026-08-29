import { OpenAICompatibleProviderAdapter, getOpenRouterApiKey } from './openai-compatible';

export class OpenRouterProviderAdapter extends OpenAICompatibleProviderAdapter {
  constructor() {
    super({ id: 'openrouter', endpoint: 'https://openrouter.ai/api/v1/chat/completions', apiKey: getOpenRouterApiKey });
  }
}
