export interface AIServiceConfig {
  serviceType: 'openai' | 'deepseek' | 'ollama' | 'claude' | 'doubao' | 'kimi' | 'tongyi' | 'xunfei' | '302ai' | 'pi'
  apiKey?: string
  baseUrl?: string
  model?: string
  systemMessage?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AIService {
  generateResponse(messages: ChatMessage[], options?: Partial<AIServiceConfig>): Promise<string>
}
