import OpenAI from 'openai'
import { AIService, AIServiceConfig, ChatMessage } from './types'

export class OpenAICompatibleService implements AIService {
  private config: AIServiceConfig
  private client: OpenAI

  constructor(config: AIServiceConfig) {
    this.config = config
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      dangerouslyAllowBrowser: true
    })
  }

  async generateResponse(messages: ChatMessage[], options?: Partial<AIServiceConfig>): Promise<string> {
    const config = { ...this.config, ...options }
    const model = config.model || 'gpt-3.5-turbo'
    
    const systemMessages: ChatMessage[] = config.systemMessage 
      ? [{ role: 'system', content: config.systemMessage }]
      : []

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: [...systemMessages, ...messages],
        temperature: 0.7
      })

      return response.choices[0]?.message?.content || ''
    } catch (error) {
      console.error('OpenAI compatible service error:', error)
      throw new Error(`AI service error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}
