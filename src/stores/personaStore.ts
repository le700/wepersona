import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 证据级别
export type EvidenceLevel = 'verbatim' | 'artifact' | 'impression'

// 角色类型
export type PersonaRole = 'self' | 'colleague' | 'mentor' | 'family' | 'partner' | 'friend' | 'public-figure'

// 数据来源平台
export type DataSourcePlatform = 'wechat' | 'feishu' | 'dingtalk' | 'slack' | 'discord' | 
  'telegram' | 'whatsapp' | 'twitter' | 'email' | 'imessage' | 'manual' | 'social-archive'

// 数据来源
export interface DataSource {
  id: string
  platform: DataSourcePlatform
  name: string
  description?: string
  collectedAt: number
  itemsCount: number
}

// 证据条目
export interface EvidenceItem {
  id: string
  content: string
  level: EvidenceLevel
  source?: string
  timestamp?: number
  context?: string
}

// 维度数据（支持富内容和证据追踪）
export interface DimensionData {
  content: string
  evidence?: EvidenceItem[]
  lastUpdated: number
}

// 冲突项
export interface ConflictItem {
  id: string
  description: string
  items: {
    content: string
    source?: string
  }[]
  resolved: boolean
  resolution?: string
}

// 版本快照
export interface PersonaSnapshot {
  id: string
  version: string
  timestamp: number
  note: string
  data: Partial<Persona>
}

// 完整的 Persona 数据模型
export interface Persona {
  id: string
  slug: string
  name: string
  role: PersonaRole
  description: string
  createdAt: number
  updatedAt: number
  
  // 四维蒸馏数据
  dimensions: {
    procedural?: DimensionData
    interaction?: DimensionData
    memory?: DimensionData
    personality?: DimensionData
  }
  
  // 数据来源
  sources: DataSource[]
  
  // 冲突追踪
  conflicts: ConflictItem[]
  
  // 版本历史
  snapshots: PersonaSnapshot[]
  
  // 元数据
  manifest?: {
    builtAt: number
    kitVersion: string
    dimensions: string[]
    fingerprints?: Record<string, string>
  }
}

// 蒸馏进度状态
export interface DistillationProgress {
  phase: 'idle' | 'collecting' | 'extracting' | 'merging' | 'complete' | 'error'
  currentStep: number
  totalSteps: number
  message: string
  error?: string
}

// Persona Store 状态
export interface PersonaStore {
  personas: Persona[]
  currentPersona: Persona | null
  distillationProgress: DistillationProgress
  
  setCurrentPersona: (persona: Persona | null) => void
  addPersona: (persona: Omit<Persona, 'id' | 'createdAt' | 'updatedAt'>) => void
  updatePersona: (id: string, updates: Partial<Persona>) => void
  deletePersona: (id: string) => void
  selectPersona: (id: string) => void
  clearPersona: () => void
  
  // 蒸馏相关
  startDistillation: () => void
  updateDistillationProgress: (progress: Partial<DistillationProgress>) => void
  resetDistillationProgress: () => void
  
  // 快照相关
  createSnapshot: (personaId: string, note: string) => void
  rollbackSnapshot: (personaId: string, snapshotId: string) => void
}

// 角色配置
export const personaRoles: { 
  id: PersonaRole; 
  name: string; 
  emoji: string; 
  description: string;
  requiredDimensions: string[];
  optionalDimensions: string[];
}[] = [
  { 
    id: 'self', 
    name: '自己', 
    emoji: '🪞', 
    description: '全维度数字分身',
    requiredDimensions: ['procedure', 'interaction', 'memory', 'personality'],
    optionalDimensions: []
  },
  { 
    id: 'colleague', 
    name: '同事', 
    emoji: '🏢', 
    description: '工作方式与沟通风格',
    requiredDimensions: ['procedure', 'interaction'],
    optionalDimensions: ['personality']
  },
  { 
    id: 'mentor', 
    name: '导师', 
    emoji: '🎓', 
    description: '教学方式与指导智慧',
    requiredDimensions: ['procedure', 'interaction', 'personality'],
    optionalDimensions: ['memory']
  },
  { 
    id: 'family', 
    name: '亲人', 
    emoji: '🏠', 
    description: '家族记忆与生活智慧',
    requiredDimensions: ['interaction', 'memory', 'personality'],
    optionalDimensions: ['procedure']
  },
  { 
    id: 'partner', 
    name: '伴侣', 
    emoji: '💕', 
    description: '关系记忆与互动模式',
    requiredDimensions: ['interaction', 'memory', 'personality'],
    optionalDimensions: ['procedure']
  },
  { 
    id: 'friend', 
    name: '朋友', 
    emoji: '🤝', 
    description: '友谊互动与共同经历',
    requiredDimensions: ['interaction', 'memory', 'personality'],
    optionalDimensions: ['procedure']
  },
  { 
    id: 'public-figure', 
    name: '公众人物', 
    emoji: '🌐', 
    description: '公开方法论',
    requiredDimensions: ['procedure', 'personality'],
    optionalDimensions: ['interaction', 'memory']
  }
]

// 平台配置
export const dataSourcePlatforms: {
  id: DataSourcePlatform
  name: string
  emoji: string
  description: string
}[] = [
  { id: 'wechat', name: '微信', emoji: '💬', description: '本地数据库或导出文件' },
  { id: 'feishu', name: '飞书', emoji: '📘', description: '飞书消息和文档' },
  { id: 'dingtalk', name: '钉钉', emoji: '📌', description: '钉钉消息' },
  { id: 'slack', name: 'Slack', emoji: '🟣', description: 'Slack 频道消息' },
  { id: 'discord', name: 'Discord', emoji: '💜', description: 'Discord 服务器' },
  { id: 'telegram', name: 'Telegram', emoji: '✈️', description: 'Telegram 聊天' },
  { id: 'whatsapp', name: 'WhatsApp', emoji: '🟢', description: 'WhatsApp 导出' },
  { id: 'twitter', name: 'Twitter/X', emoji: '🐦', description: '推文归档' },
  { id: 'email', name: '邮件', emoji: '📧', description: '邮件归档' },
  { id: 'imessage', name: 'iMessage', emoji: '💙', description: 'macOS 信息' },
  { id: 'manual', name: '手动输入', emoji: '✏️', description: '粘贴或上传文件' },
  { id: 'social-archive', name: '社交归档', emoji: '📦', description: '其他社交平台导出' }
]

// 维度配置
export const dimensionConfig: {
  id: string
  name: string
  description: string
  icon: string
}[] = [
  { id: 'procedure', name: '程序性', description: '怎么做事 - 工作方式、流程偏好、决策逻辑', icon: '⚙️' },
  { id: 'interaction', name: '互动性', description: '怎么说话 - 沟通风格、表达方式、互动模式', icon: '💬' },
  { id: 'memory', name: '记忆', description: '经历过什么 - 重要事件、共同回忆、关键经历', icon: '📖' },
  { id: 'personality', name: '性格', description: '是什么人 - 性格特点、价值观、偏好', icon: '🧠' }
]

// 证据级别说明
export const evidenceLevelInfo: Record<EvidenceLevel, { name: string; description: string }> = {
  verbatim: { name: '原话', description: '直接引用的原话，可信度最高' },
  artifact: { name: '文档', description: '从文字材料中提炼的信息，可信度高' },
  impression: { name: '印象', description: '主观观察或印象，可信度较低' }
}

export const usePersonaStore = create<PersonaStore>()(
  persist(
    (set, get) => ({
      personas: [],
      currentPersona: null,
      distillationProgress: {
        phase: 'idle',
        currentStep: 0,
        totalSteps: 5,
        message: ''
      },
      
      setCurrentPersona: (persona) => set({ currentPersona: persona }),
      
      addPersona: (personaData) => {
        let slugFromName = personaData.name
          .replace(/[^\w\s\u4e00-\u9fa5-]/g, '')
          .replace(/\s+/g, '-')
          .toLowerCase()
          .replace(/^-+|-+$/g, '')
        
        const newPersona: Persona = {
          ...personaData,
          id: `persona-${Date.now()}`,
          slug: personaData.slug || slugFromName,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          sources: personaData.sources || [],
          conflicts: personaData.conflicts || [],
          snapshots: []
        }
        set((state) => ({ personas: [...state.personas, newPersona] }))
      },
      
      updatePersona: (id, updates) => {
        set((state) => ({
          personas: state.personas.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
          ),
          currentPersona: state.currentPersona?.id === id 
            ? { ...state.currentPersona, ...updates, updatedAt: Date.now() } 
            : state.currentPersona
        }))
      },
      
      deletePersona: (id) => {
        set((state) => ({
          personas: state.personas.filter((p) => p.id !== id),
          currentPersona: state.currentPersona?.id === id ? null : state.currentPersona
        }))
      },
      
      selectPersona: (id) => {
        const persona = get().personas.find((p) => p.id === id)
        set({ currentPersona: persona || null })
      },
      
      clearPersona: () => set({ currentPersona: null }),
      
      startDistillation: () => set({
        distillationProgress: {
          phase: 'collecting',
          currentStep: 1,
          totalSteps: 5,
          message: '正在收集数据...'
        }
      }),
      
      updateDistillationProgress: (progress) => set((state) => ({
        distillationProgress: { ...state.distillationProgress, ...progress }
      })),
      
      resetDistillationProgress: () => set({
        distillationProgress: {
          phase: 'idle',
          currentStep: 0,
          totalSteps: 5,
          message: ''
        }
      }),
      
      createSnapshot: (personaId, note) => {
        const state = get()
        const persona = state.personas.find(p => p.id === personaId)
        if (!persona) return
        
        const snapshot: PersonaSnapshot = {
          id: `snapshot-${Date.now()}`,
          version: `v${persona.snapshots.length + 1}`,
          timestamp: Date.now(),
          note,
          data: JSON.parse(JSON.stringify(persona))
        }
        
        set((s) => ({
          personas: s.personas.map(p => 
            p.id === personaId 
              ? { ...p, snapshots: [...p.snapshots, snapshot], updatedAt: Date.now() }
              : p
          ),
          currentPersona: s.currentPersona?.id === personaId
            ? { ...s.currentPersona, snapshots: [...s.currentPersona.snapshots, snapshot], updatedAt: Date.now() }
            : s.currentPersona
        }))
      },
      
      rollbackSnapshot: (personaId, snapshotId) => {
        const state = get()
        const persona = state.personas.find(p => p.id === personaId)
        if (!persona) return
        
        const snapshot = persona.snapshots.find(s => s.id === snapshotId)
        if (!snapshot) return
        
        // 先创建一个当前状态的快照
        get().createSnapshot(personaId, '回滚前备份')
        
        set((s) => ({
          personas: s.personas.map(p => 
            p.id === personaId 
              ? { ...p, ...snapshot.data, id: p.id, updatedAt: Date.now() }
              : p
          ),
          currentPersona: s.currentPersona?.id === personaId
            ? { ...s.currentPersona, ...snapshot.data, id: s.currentPersona.id, updatedAt: Date.now() }
            : s.currentPersona
        }))
      }
    }),
    {
      name: 'wepersona-personas'
    }
  )
)