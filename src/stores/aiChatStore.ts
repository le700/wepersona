import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { AIServiceManager } from '../services/ai/aiService'
import { useAIConfigStore } from './aiConfigStore'
import { usePersonaStore, type Persona } from './personaStore'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  personaId?: string
}

export interface ChatSession {
  id: string
  name: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
  personaId?: string
}

export interface AIChatStore {
  sessions: ChatSession[]
  currentSession: ChatSession | null
  isGenerating: boolean
  error: string | null
  setCurrentSession: (session: ChatSession | null) => void
  createSession: (name: string, personaId?: string) => void
  addMessage: (sessionId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  updateSession: (id: string, updates: Partial<ChatSession>) => void
  deleteSession: (id: string) => void
  selectSession: (id: string) => void
  clearCurrentSession: () => void
  setIsGenerating: (generating: boolean) => void
  setError: (error: string | null) => void
  generateResponse: (sessionId: string, personaId?: string) => Promise<void>
}

function buildPersonaSystemMessage(persona: Persona): string {
  let systemMessage = `你需要扮演以下角色进行对话：\n`
  systemMessage += `名字：${persona.name}\n`
  systemMessage += `角色：${persona.role}\n`
  
  if (persona.description) {
    systemMessage += `描述：${persona.description}\n`
  }
  
  if (persona.dimensions) {
    if (persona.dimensions.personality) {
      systemMessage += `性格特点：${persona.dimensions.personality}\n`
    }
    if (persona.dimensions.interaction) {
      systemMessage += `互动方式：${persona.dimensions.interaction}\n`
    }
    if (persona.dimensions.procedural) {
      systemMessage += `处事方式：${persona.dimensions.procedural}\n`
    }
    if (persona.dimensions.memory) {
      systemMessage += `记忆：${persona.dimensions.memory}\n`
    }
  }
  
  systemMessage += `\n请你完全按照这个角色的设定进行回复。`
  return systemMessage
}

export const useAIChatStore = create<AIChatStore>()(
  persist(
    (set, get) => ({
      sessions: [],
      currentSession: null,
      isGenerating: false,
      error: null,
      setCurrentSession: (session) => set({ currentSession: session }),
      createSession: (name, personaId) => {
        const newSession: ChatSession = {
          id: `session-${Date.now()}`,
          name,
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          personaId
        }
        set((state) => ({ sessions: [...state.sessions, newSession], currentSession: newSession }))
      },
      addMessage: (sessionId, message) => {
        const newMessage: ChatMessage = {
          ...message,
          id: `msg-${Date.now()}`,
          timestamp: Date.now()
        }
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? { ...s, messages: [...s.messages, newMessage], updatedAt: Date.now() }
              : s
          ),
          currentSession: state.currentSession?.id === sessionId
            ? { ...state.currentSession, messages: [...state.currentSession.messages, newMessage], updatedAt: Date.now() }
            : state.currentSession
        }))
      },
      updateSession: (id, updates) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s
          ),
          currentSession: state.currentSession?.id === id
            ? { ...state.currentSession, ...updates, updatedAt: Date.now() }
            : state.currentSession
        }))
      },
      deleteSession: (id) => {
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
          currentSession: state.currentSession?.id === id ? null : state.currentSession
        }))
      },
      selectSession: (id) => {
        const session = get().sessions.find((s) => s.id === id)
        set({ currentSession: session || null })
      },
      clearCurrentSession: () => set({ currentSession: null }),
      setIsGenerating: (generating) => set({ isGenerating: generating }),
      setError: (error) => set({ error }),
      generateResponse: async (sessionId, personaId) => {
        const state = get()
        const session = state.sessions.find((s) => s.id === sessionId)
        
        if (!session || session.messages.length === 0) return

        const lastMessage = session.messages[session.messages.length - 1]
        if (lastMessage.role === 'assistant') return

        const aiConfig = useAIConfigStore.getState()
        
        if (!aiConfig.config || !aiConfig.isConfigured) {
          const errorMsg = 'AI服务未配置，请先在设置中配置AI服务'
          set({ error: errorMsg })
          return
        }

        set({ isGenerating: true, error: null })

        try {
          // Configure AI service
          const aiManager = AIServiceManager.getInstance()
          let systemMessage = aiConfig.config.systemMessage
          
          // If persona is selected, build persona-specific system message
          let persona: Persona | undefined
          if (personaId) {
            const personaStore = usePersonaStore.getState()
            persona = personaStore.personas.find(p => p.id === personaId)
            if (persona) {
              systemMessage = buildPersonaSystemMessage(persona)
            }
          }

          aiManager.configure({
            ...aiConfig.config,
            systemMessage
          })

          // Prepare messages (exclude persona system message from history)
          const chatMessages = session.messages.map(msg => ({
            role: msg.role,
            content: msg.content
          }))

          // Generate response
          const response = await aiManager.generateResponse(chatMessages, {
            systemMessage
          })

          // Add response
          get().addMessage(sessionId, {
            role: 'assistant',
            content: response,
            personaId
          })

        } catch (error) {
          console.error('AI generation error:', error)
          set({ 
            error: error instanceof Error 
              ? `AI回复生成失败：${error.message}` 
              : 'AI回复生成失败：未知错误' 
          })
          
          // Fallback to mock response if AI fails
          const mockResponses = [
            '抱歉，AI服务暂时不可用。让我先为您提供一个简单的回复...',
            'AI服务连接失败，请检查您的配置。',
            '这是一个模拟回复。请检查您的AI服务配置。'
          ]
          get().addMessage(sessionId, {
            role: 'assistant',
            content: mockResponses[Math.floor(Math.random() * mockResponses.length)],
            personaId
          })
        } finally {
          set({ isGenerating: false })
        }
      }
    }),
    {
      name: 'wepersona-ai-chat'
    }
  )
)