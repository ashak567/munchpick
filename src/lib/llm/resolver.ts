import { LLMProvider, ProviderCapabilities, GatewayHealth } from './types';
import { GeminiProviderAdapter } from './providers/gemini';
import { llmConfig } from './config';

export class ProviderResolver {
  private providers = new Map<string, LLMProvider>();

  constructor() {
    // Register available provider adapters
    this.registerProvider(new GeminiProviderAdapter());
    // (Future adapters like GPT, Claude, and DeepSeek can register here)
  }

  public registerProvider(provider: LLMProvider): void {
    this.providers.set(provider.id, provider);
  }

  /**
   * Resolves the optimal provider.
   * If a targetProviderId is specified, attempts to use it.
   * If not, fallback to the default provider from configuration.
   * Checks health registry to avoid degraded/unhealthy providers.
   */
  public resolve(
    capabilities: ProviderCapabilities,
    healthRegistry: Map<string, GatewayHealth>,
    targetProviderId?: string
  ): LLMProvider {
    const selectedId = targetProviderId || llmConfig.defaultProvider;
    
    // Attempt resolving target
    let provider = this.providers.get(selectedId);
    let health = healthRegistry.get(selectedId);

    // If no target provider is explicitly requested, or if target is unhealthy/missing, try fallback
    if (!targetProviderId) {
      if (!provider || (health && health.status === 'unhealthy')) {
        for (const [id, prov] of this.providers.entries()) {
          const provHealth = healthRegistry.get(id);
          if (!provHealth || provHealth.status === 'healthy') {
            if (prov.validateCapabilities(capabilities)) {
              provider = prov;
              break;
            }
          }
        }
      }
    }

    // Default fallback to first registered provider if everything is degraded
    if (!provider) {
      provider = this.providers.get('gemini') || this.providers.values().next().value;
    }

    if (!provider) {
      throw new Error('LLM Provider Resolver: No active provider found.');
    }

    // Check capabilities
    if (!provider.validateCapabilities(capabilities)) {
      throw new Error(`LLM Provider Resolver: Provider '${provider.id}' does not support required capabilities.`);
    }

    return provider;
  }
}
