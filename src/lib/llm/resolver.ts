import { LLMProvider, ProviderCapabilities, GatewayHealth } from './types';
import { GeminiProviderAdapter } from './providers/gemini';
import { AnthropicProviderAdapter } from './providers/anthropic';
import { llmConfig } from './config';

export class ProviderResolver {
  private providers = new Map<string, LLMProvider>();

  constructor() {
    // Register available provider adapters
    this.registerProvider(new GeminiProviderAdapter());
    this.registerProvider(new AnthropicProviderAdapter());
  }

  public registerProvider(provider: LLMProvider): void {
    this.providers.set(provider.id, provider);
    if (provider.id === 'anthropic') {
      this.providers.set('claude', provider);
    }
  }

  /**
   * Resolves the provider explicitly or by default configuration.
   * Fails fast if requested provider is unknown or lacks required capabilities.
   */
  public resolve(
    capabilities: ProviderCapabilities,
    _healthRegistry: Map<string, GatewayHealth>,
    targetProviderId?: string
  ): LLMProvider {
    const selectedId = targetProviderId || llmConfig.defaultProvider;
    const provider = this.providers.get(selectedId);

    if (!provider) {
      throw new Error(`LLM Provider Resolver: Provider '${selectedId}' is not registered.`);
    }

    // Check capabilities
    if (!provider.validateCapabilities(capabilities)) {
      throw new Error(`LLM Provider Resolver: Provider '${provider.id}' does not support required capabilities.`);
    }

    return provider;
  }
}
