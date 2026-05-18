import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('zustand/middleware', async () => {
  const actual = await vi.importActual('zustand/middleware')
  return {
    ...actual as any,
    persist: vi.fn((fn) => fn)
  }
})

import { create } from 'zustand'
import { Persona, PersonaRole, PersonaSnapshot } from '../stores/personaStore'

const createTestStore = () => create<{
  personas: Persona[]
  currentPersona: Persona | null
  distillationProgress: {
    phase: 'idle' | 'collecting' | 'extracting' | 'merging' | 'complete' | 'error'
    currentStep: number
    totalSteps: number
    message: string
    error?: string
  }
  setCurrentPersona: (persona: Persona | null) => void
  addPersona: (personaData: Omit<Persona, 'id' | 'createdAt' | 'updatedAt'>) => void
  updatePersona: (id: string, updates: Partial<Persona>) => void
  deletePersona: (id: string) => void
  selectPersona: (id: string) => void
  clearPersona: () => void
  startDistillation: () => void
  updateDistillationProgress: (progress: Partial<{
    phase: string
    currentStep: number
    totalSteps: number
    message: string
    error?: string
  }>) => void
  resetDistillationProgress: () => void
  createSnapshot: (personaId: string, note: string) => void
  rollbackSnapshot: (personaId: string, snapshotId: string) => void
}>()((set, get) => ({
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
      id: `persona-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
}))

describe('PersonaStore - 人格创建功能', () => {
  let store: ReturnType<typeof createTestStore>

  beforeEach(() => {
    store = createTestStore()
  })

  it('应该正确添加新的人格', () => {
    const personaData = {
      name: '测试人格',
      role: 'self' as PersonaRole,
      description: '这是一个测试人格',
      dimensions: {
        procedural: {
          content: '测试内容',
          evidence: [],
          lastUpdated: Date.now()
        }
      },
      sources: [],
      conflicts: [],
      snapshots: [],
      slug: 'ceshi-renge'
    }

    store.getState().addPersona(personaData)
    
    const personas = store.getState().personas
    expect(personas).toHaveLength(1)
    expect(personas[0].name).toBe('测试人格')
    expect(personas[0].role).toBe('self')
    expect(personas[0].description).toBe('这是一个测试人格')
    expect(personas[0].id).toMatch(/^persona-\d+/)
  })

  it('应该自动生成 slug', () => {
    const personaData = {
      name: '我的数字人格',
      role: 'friend' as PersonaRole,
      description: '测试',
      dimensions: {},
      sources: [],
      conflicts: [],
      snapshots: []
    }

    store.getState().addPersona(personaData)
    
    const persona = store.getState().personas[0]
    expect(persona.slug).toBe('我的数字人格')
  })

  it('应该自动设置创建和更新时间戳', () => {
    const beforeCreate = Date.now() - 1
    
    const personaData = {
      name: '时间戳测试',
      role: 'colleague' as PersonaRole,
      description: '测试时间戳',
      dimensions: {},
      sources: [],
      conflicts: [],
      snapshots: []
    }

    store.getState().addPersona(personaData)
    
    const afterCreate = Date.now() + 1
    const persona = store.getState().personas[0]
    
    expect(persona.createdAt).toBeGreaterThanOrEqual(beforeCreate)
    expect(persona.createdAt).toBeLessThanOrEqual(afterCreate)
    expect(persona.updatedAt).toBeGreaterThanOrEqual(beforeCreate)
    expect(persona.updatedAt).toBeLessThanOrEqual(afterCreate)
  })

  it('应该支持空名称的人格创建', () => {
    const personaData = {
      name: '',
      role: 'self' as PersonaRole,
      description: '测试',
      dimensions: {},
      sources: [],
      conflicts: [],
      snapshots: []
    }

    store.getState().addPersona(personaData)
    
    expect(store.getState().personas).toHaveLength(1)
    expect(store.getState().personas[0].name).toBe('')
  })

  it('应该正确处理多个人格的创建', () => {
    const roles: PersonaRole[] = ['self', 'colleague', 'friend', 'partner', 'family', 'mentor', 'public-figure']
    
    roles.forEach((role, index) => {
      store.getState().addPersona({
        name: `人格 ${index + 1}`,
        role,
        description: `角色类型: ${role}`,
        dimensions: {},
        sources: [],
        conflicts: [],
        snapshots: []
      })
    })

    expect(store.getState().personas).toHaveLength(7)
    expect(store.getState().personas.map(p => p.role)).toEqual(roles)
  })

  it('应该正确处理维度数据的创建', () => {
    const personaData = {
      name: '维度测试人格',
      role: 'self' as PersonaRole,
      description: '测试维度数据',
      dimensions: {
        procedural: {
          content: '程序性内容',
          evidence: [{ id: '1', content: '证据1', level: 'verbatim' as const }],
          lastUpdated: Date.now()
        },
        interaction: {
          content: '互动性内容',
          evidence: [],
          lastUpdated: Date.now()
        },
        memory: {
          content: '记忆内容',
          evidence: [{ id: '2', content: '证据2', level: 'artifact' as const }],
          lastUpdated: Date.now()
        },
        personality: {
          content: '性格内容',
          evidence: [],
          lastUpdated: Date.now()
        }
      },
      sources: [],
      conflicts: [],
      snapshots: []
    }

    store.getState().addPersona(personaData)
    
    const persona = store.getState().personas[0]
    expect(persona.dimensions.procedural?.content).toBe('程序性内容')
    expect(persona.dimensions.procedural?.evidence).toHaveLength(1)
    expect(persona.dimensions.interaction?.content).toBe('互动性内容')
    expect(persona.dimensions.memory?.evidence[0].level).toBe('artifact')
  })

  it('应该处理特殊字符在名称中', () => {
    const personaData = {
      name: '测试用户',
      role: 'self' as PersonaRole,
      description: '特殊字符测试',
      dimensions: {},
      sources: [],
      conflicts: [],
      snapshots: []
    }

    store.getState().addPersona(personaData)
    
    const persona = store.getState().personas[0]
    expect(persona.name).toBe('测试用户')
    expect(persona.slug).toBe('测试用户')
  })
})

describe('PersonaStore - 人格编辑功能', () => {
  let store: ReturnType<typeof createTestStore>
  let testPersonaId: string

  beforeEach(() => {
    store = createTestStore()
    store.getState().addPersona({
      name: '原始人格',
      role: 'self' as PersonaRole,
      description: '原始描述',
      dimensions: {
        procedural: {
          content: '原始程序性内容',
          evidence: [],
          lastUpdated: Date.now()
        }
      },
      sources: [],
      conflicts: [],
      snapshots: []
    })
    testPersonaId = store.getState().personas[0].id
  })

  it('应该正确更新人格基本信息', () => {
    store.getState().updatePersona(testPersonaId, {
      name: '更新后人格',
      description: '更新后描述'
    })

    const persona = store.getState().personas[0]
    expect(persona.name).toBe('更新后人格')
    expect(persona.description).toBe('更新后描述')
  })

  it('应该更新人格角色类型', () => {
    store.getState().updatePersona(testPersonaId, {
      role: 'friend'
    })

    expect(store.getState().personas[0].role).toBe('friend')
  })

  it('应该同时更新 updatedAt 时间戳', () => {
    const originalPersona = store.getState().personas[0]
    const originalUpdatedAt = originalPersona.updatedAt
    
    store.getState().updatePersona(testPersonaId, {
      name: '更新的名称'
    })

    const updatedPersona = store.getState().personas[0]
    expect(updatedPersona.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt)
  })

  it('应该同时更新 currentPersona 如果是当前选中的人格', () => {
    store.getState().selectPersona(testPersonaId)
    
    expect(store.getState().currentPersona?.id).toBe(testPersonaId)
    
    store.getState().updatePersona(testPersonaId, {
      name: '同步更新的名称'
    })

    expect(store.getState().currentPersona?.name).toBe('同步更新的名称')
  })

  it('不应该更新不存在的人格', () => {
    store.getState().updatePersona('non-existent-id', {
      name: '不应该更新'
    })

    expect(store.getState().personas[0].name).toBe('原始人格')
  })

  it('应该正确更新维度数据', () => {
    store.getState().updatePersona(testPersonaId, {
      dimensions: {
        ...store.getState().personas[0].dimensions,
        interaction: {
          content: '新的互动内容',
          evidence: [],
          lastUpdated: Date.now()
        }
      }
    })

    const persona = store.getState().personas[0]
    expect(persona.dimensions.interaction?.content).toBe('新的互动内容')
    expect(persona.dimensions.procedural?.content).toBe('原始程序性内容')
  })

  it('应该保留更新时不包含的字段', () => {
    store.getState().updatePersona(testPersonaId, {
      name: '只更新名称'
    })

    const persona = store.getState().personas[0]
    expect(persona.role).toBe('self')
    expect(persona.description).toBe('原始描述')
    expect(persona.dimensions.procedural?.content).toBe('原始程序性内容')
  })
})

describe('PersonaStore - 人格删除功能', () => {
  let store: ReturnType<typeof createTestStore>
  let personaIds: string[]

  beforeEach(() => {
    store = createTestStore()
    
    const personas = [
      { name: '人格1', role: 'self' as PersonaRole },
      { name: '人格2', role: 'friend' as PersonaRole },
      { name: '人格3', role: 'colleague' as PersonaRole }
    ]

    personas.forEach(p => {
      store.getState().addPersona({
        name: p.name,
        role: p.role,
        description: `描述 ${p.name}`,
        dimensions: {},
        sources: [],
        conflicts: [],
        snapshots: []
      })
    })

    personaIds = store.getState().personas.map(p => p.id)
  })

  it('应该正确删除指定人格', () => {
    store.getState().deletePersona(personaIds[1])
    
    expect(store.getState().personas).toHaveLength(2)
    expect(store.getState().personas.find(p => p.id === personaIds[1])).toBeUndefined()
    expect(store.getState().personas.map(p => p.name)).toEqual(['人格1', '人格3'])
  })

  it('删除当前选中的人格后应该清除 currentPersona', () => {
    store.getState().selectPersona(personaIds[1])
    expect(store.getState().currentPersona?.id).toBe(personaIds[1])
    
    store.getState().deletePersona(personaIds[1])
    
    expect(store.getState().currentPersona).toBeNull()
  })

  it('删除非选中人格后 currentPersona 应该保持不变', () => {
    store.getState().selectPersona(personaIds[0])
    store.getState().deletePersona(personaIds[1])
    
    expect(store.getState().currentPersona?.id).toBe(personaIds[0])
  })

  it('删除不存在的人格不应该影响其他数据', () => {
    const initialPersonas = [...store.getState().personas]
    store.getState().deletePersona('non-existent-id')
    
    expect(store.getState().personas).toEqual(initialPersonas)
  })

  it('应该支持连续删除多个人格', () => {
    store.getState().deletePersona(personaIds[0])
    store.getState().deletePersona(personaIds[2])
    
    expect(store.getState().personas).toHaveLength(1)
    expect(store.getState().personas[0].name).toBe('人格2')
  })

  it('删除所有人格后 personas 应该为空数组', () => {
    personaIds.forEach(id => {
      store.getState().deletePersona(id)
    })
    
    expect(store.getState().personas).toHaveLength(0)
    expect(store.getState().currentPersona).toBeNull()
  })
})

describe('PersonaStore - 选择和状态管理', () => {
  let store: ReturnType<typeof createTestStore>

  beforeEach(() => {
    store = createTestStore()
  })

  it('应该正确选择人格', () => {
    store.getState().addPersona({
      name: '可选择人格',
      role: 'self' as PersonaRole,
      description: '测试',
      dimensions: {},
      sources: [],
      conflicts: [],
      snapshots: []
    })

    const personaId = store.getState().personas[0].id
    store.getState().selectPersona(personaId)
    
    expect(store.getState().currentPersona?.id).toBe(personaId)
    expect(store.getState().currentPersona?.name).toBe('可选择人格')
  })

  it('选择空 ID 应该清除当前选中', () => {
    store.getState().selectPersona('')
    expect(store.getState().currentPersona).toBeNull()
  })

  it('选择不存在的人格 ID 应该清除当前选中', () => {
    store.getState().selectPersona('non-existent-id')
    expect(store.getState().currentPersona).toBeNull()
  })

  it('clearPersona 应该清除当前选中', () => {
    store.getState().addPersona({
      name: '测试人格',
      role: 'self' as PersonaRole,
      description: '测试',
      dimensions: {},
      sources: [],
      conflicts: [],
      snapshots: []
    })

    store.getState().selectPersona(store.getState().personas[0].id)
    store.getState().clearPersona()
    
    expect(store.getState().currentPersona).toBeNull()
  })
})

describe('PersonaStore - 快照功能', () => {
  let store: ReturnType<typeof createTestStore>
  let personaId: string

  beforeEach(() => {
    store = createTestStore()
    store.getState().addPersona({
      name: '快照测试人格',
      role: 'self' as PersonaRole,
      description: '用于测试快照功能',
      dimensions: {
        procedural: {
          content: '测试内容',
          evidence: [],
          lastUpdated: Date.now()
        }
      },
      sources: [],
      conflicts: [],
      snapshots: []
    })
    personaId = store.getState().personas[0].id
  })

  it('应该正确创建快照', () => {
    store.getState().createSnapshot(personaId, '测试快照')
    
    const persona = store.getState().personas[0]
    expect(persona.snapshots).toHaveLength(1)
    expect(persona.snapshots[0].note).toBe('测试快照')
    expect(persona.snapshots[0].version).toBe('v1')
    expect(persona.snapshots[0].data.name).toBe('快照测试人格')
  })

  it('应该自动递增版本号', () => {
    store.getState().createSnapshot(personaId, '快照1')
    store.getState().createSnapshot(personaId, '快照2')
    store.getState().createSnapshot(personaId, '快照3')
    
    const snapshots = store.getState().personas[0].snapshots
    expect(snapshots[0].version).toBe('v1')
    expect(snapshots[1].version).toBe('v2')
    expect(snapshots[2].version).toBe('v3')
  })

  it('快照应该包含完整的人格数据副本', () => {
    store.getState().createSnapshot(personaId, '完整副本测试')
    
    const snapshot = store.getState().personas[0].snapshots[0]
    expect(snapshot.data.name).toBe('快照测试人格')
    expect(snapshot.data.description).toBe('用于测试快照功能')
    expect(snapshot.data.dimensions?.procedural?.content).toBe('测试内容')
  })

  it('对不存在的人格创建快照不应该报错', () => {
    expect(() => {
      store.getState().createSnapshot('non-existent-id', '不应该创建')
    }).not.toThrow()
    
    expect(store.getState().personas[0].snapshots).toHaveLength(0)
  })

  it('回滚快照应该能恢复人格数据', () => {
    const originalName = store.getState().personas[0].name
    
    store.getState().updatePersona(personaId, { name: '修改后的名称' })
    expect(store.getState().personas[0].name).toBe('修改后的名称')
    
    store.getState().createSnapshot(personaId, '手动备份')
    expect(store.getState().personas[0].snapshots.length).toBe(1)
  })
})

describe('PersonaStore - 蒸馏进度管理', () => {
  let store: ReturnType<typeof createTestStore>

  beforeEach(() => {
    store = createTestStore()
  })

  it('初始状态应该是 idle', () => {
    expect(store.getState().distillationProgress.phase).toBe('idle')
    expect(store.getState().distillationProgress.currentStep).toBe(0)
  })

  it('startDistillation 应该设置正确的初始状态', () => {
    store.getState().startDistillation()
    
    const progress = store.getState().distillationProgress
    expect(progress.phase).toBe('collecting')
    expect(progress.currentStep).toBe(1)
    expect(progress.message).toBe('正在收集数据...')
  })

  it('updateDistillationProgress 应该更新进度', () => {
    store.getState().startDistillation()
    store.getState().updateDistillationProgress({
      phase: 'extracting',
      currentStep: 2,
      message: '正在提取维度...'
    })
    
    const progress = store.getState().distillationProgress
    expect(progress.phase).toBe('extracting')
    expect(progress.currentStep).toBe(2)
    expect(progress.message).toBe('正在提取维度...')
  })

  it('resetDistillationProgress 应该重置状态', () => {
    store.getState().startDistillation()
    store.getState().updateDistillationProgress({
      phase: 'error',
      message: '出错了'
    })
    
    store.getState().resetDistillationProgress()
    
    const progress = store.getState().distillationProgress
    expect(progress.phase).toBe('idle')
    expect(progress.currentStep).toBe(0)
    expect(progress.message).toBe('')
  })

  it('应该支持更新部分进度字段', () => {
    store.getState().updateDistillationProgress({
      phase: 'complete'
    })
    
    expect(store.getState().distillationProgress.phase).toBe('complete')
    expect(store.getState().distillationProgress.currentStep).toBe(0)
  })
})
