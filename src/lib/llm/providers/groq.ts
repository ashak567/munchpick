import { OpenAICompatibleProviderAdapter, getGroqApiKey } from './openai-compatible';

export class GroqProviderAdapter extends OpenAICompatibleProviderAdapter {
  constructor() {
    super({ id: 'groq', endpoint: 'https://api.groq.com/openai/v1/chat/completions', apiKey: getGroqApiKey });
  }
}
