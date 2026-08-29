import { LLMProvider, ProviderCapabilities, GatewayHealth } from './types';
import { GeminiProviderAdapter } from './providers/gemini';
import { GroqProviderAdapter } from './providers/groq';
import { OpenRouterProviderAdapter } from './providers/openrouter';
import { llmConfig } from './config';

export class ProviderResolver {
  private providers = new Map<string, LLMProvider>();

  constructor() {
    // Register available approved provider adapters (Gemini -> Groq -> OpenRouter)
    this.registerProvider(new GeminiProviderAdapter());
    this.registerProvider(new GroqProviderAdapter());
    this.registerProvider(new OpenRouterProviderAdapter());
  }

  public registerProvider(provider: LLMProvider): void {
    this.providers.set(provider.id, provider);
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

  /** Resolve the primary provider plus configured fallbacks for transient failures. */
  public resolveCandidates(
    capabilities: ProviderCapabilities,
    healthRegistry: Map<string, GatewayHealth>,
    targetProviderId?: string
  ): LLMProvider[] {
    // An explicit provider request is intentional and must not silently route elsewhere.
    if (targetProviderId) {
      return [this.resolve(capabilities, healthRegistry, targetProviderId)];
    }

    const providerIds = [llmConfig.defaultProvider, ...llmConfig.fallbackProviders]
      .map(id => id.toLowerCase())
      .filter((id, index, all) => all.indexOf(id) === index);

    const providers = providerIds
      .map(id => this.providers.get(id))
      .filter((provider): provider is LLMProvider => Boolean(provider))
      .filter(provider => provider.validateCapabilities(capabilities));

    if (providers.length === 0) {
      throw new Error('LLM Provider Resolver: No configured provider supports this request.');
    }

    return providers;
  }
}
