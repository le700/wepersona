import axios from 'axios'
import { AIService, AIServiceConfig, ChatMessage } from './types'

export class OllamaService implements AIService {
  private config: AIServiceConfig

  constructor(config: AIServiceConfig) {
    this.config = config
  }

  async generateResponse(messages: ChatMessage[], options?: Partial<AIServiceConfig>): Promise<string> {
    const config = { ...this.config, ...options }
    const baseUrl = config.baseUrl || 'http://localhost:11434'
    const model = config.model || 'llama2'

    try {
      const systemMessages: ChatMessage[] = config.systemMessage 
        ? [{ role: 'system', content: config.systemMessage }]
        : []

      const response = await axios.post(`${baseUrl}/api/chat`, {
        model,
        messages: [...systemMessages, ...messages],
        stream: false
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })

      return response.data?.message?.content || ''
    } catch (error) {
      console.error('Ollama service error:', error)
      throw new Error(`Ollama service error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}
