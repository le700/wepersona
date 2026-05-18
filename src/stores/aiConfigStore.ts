import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { AIServiceConfig } from '../services/ai/types'

export interface AIConfigState {
  config: AIServiceConfig | null
  isConfigured: boolean
  setConfig: (config: AIServiceConfig) => void
  clearConfig: () => void
  updateConfig: (updates: Partial<AIServiceConfig>) => void
}

const defaultConfig: Partial<AIServiceConfig> = {
  serviceType: 'deepseek',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  systemMessage: '你是一个友好的助手。'
}

export const useAIConfigStore = create<AIConfigState>()(
  persist(
    (set, get) => ({
      config: null,
      isConfigured: false,
      setConfig: (config: AIServiceConfig) => {
        set({ config, isConfigured: true })
      },
      clearConfig: () => {
        set({ config: null, isConfigured: false })
      },
      updateConfig: (updates: Partial<AIServiceConfig>) => {
        const currentConfig = get().config
        if (currentConfig) {
          const newConfig = { ...currentConfig, ...updates }
          set({ config: newConfig, isConfigured: true })
        } else {
          const newConfig = { ...defaultConfig, ...updates } as AIServiceConfig
          set({ config: newConfig, isConfigured: true })
        }
      }
    }),
    {
      name: 'wepersona-ai-config'
    }
  )
)

// Service type presets
export const servicePresets: Record<string, Partial<AIServiceConfig>> = {
  deepseek: {
    serviceType: 'deepseek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    systemMessage: '你是一个友好的助手。'
  },
  openai: {
    serviceType: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-3.5-turbo',
    systemMessage: 'You are a helpful assistant.'
  },
  ollama: {
    serviceType: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'llama2',
    systemMessage: '你是一个友好的助手。'
  },
  claude: {
    serviceType: 'claude',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-3-sonnet-20240229',
    systemMessage: '你是一个友好的助手。'
  },
  kimi: {
    serviceType: 'kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
    systemMessage: '你是一个友好的助手。'
  },
  doubao: {
    serviceType: 'doubao',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'ep-20240722143518-9s557',
    systemMessage: '你是一个友好的助手。'
  }
}
