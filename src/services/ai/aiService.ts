import { AIService, AIServiceConfig, ChatMessage } from './types'
import { OpenAICompatibleService } from './openaiCompatible'
import { OllamaService } from './ollama'

export class AIServiceFactory {
  static createService(config: AIServiceConfig): AIService {
    switch (config.serviceType) {
      case 'openai':
      case 'deepseek':
      case 'claude':
      case 'doubao':
      case 'kimi':
      case 'tongyi':
      case 'xunfei':
      case '302ai':
        return new OpenAICompatibleService(config)
      case 'ollama':
        return new OllamaService(config)
      case 'pi':
        // For now, use OpenAI compatible for PI, can be extended
        return new OpenAICompatibleService(config)
      default:
        throw new Error(`Unsupported AI service type: ${config.serviceType}`)
    }
  }
}

export class AIServiceManager {
  private static instance: AIServiceManager
  private service: AIService | null = null
  private config: AIServiceConfig | null = null

  private constructor() {}

  static getInstance(): AIServiceManager {
    if (!AIServiceManager.instance) {
      AIServiceManager.instance = new AIServiceManager()
    }
    return AIServiceManager.instance
  }

  configure(config: AIServiceConfig) {
    this.config = config
    this.service = AIServiceFactory.createService(config)
  }

  async generateResponse(messages: ChatMessage[], options?: Partial<AIServiceConfig>): Promise<string> {
    if (!this.service) {
      throw new Error('AI service not configured. Please configure the service first.')
    }
    return this.service.generateResponse(messages, options)
  }

  getConfig(): AIServiceConfig | null {
    return this.config
  }
}
