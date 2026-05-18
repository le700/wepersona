import { describe, it, expect, beforeEach } from 'vitest'
import { 
  PersonaDistiller, 
  createPersonaDistiller,
  DistillationConfig,
  RawCollectedData,
  ProcessedMessage
} from '../services/personaDistiller'
import { ChatSession, Message } from '../types/models'

const createMockChatSession = (username: string, displayName: string): ChatSession => ({
  username,
  displayName,
  type: 1,
  unreadCount: 0,
  summary: '',
  sortTimestamp: Date.now(),
  lastTimestamp: Date.now(),
  lastMsgType: 1
})

const createMockMessage = (
  messageKey: string, 
  senderUsername: string,
  senderDisplayName: string,
  content: string,
  isSend: number
): Message => ({
  messageKey,
  localId: 1,
  createTime: Date.now(),
  parsedContent: content,
  senderUsername,
  senderDisplayName,
  isSend,
  content: '',
  type: 1
})

describe('PersonaDistiller - 人格蒸馏服务', () => {
  describe('数据收集功能', () => {
    it('应该正确从微信聊天记录收集数据', () => {
      const config: DistillationConfig = {
        targetPerson: '张三',
        role: 'friend',
        selectedDimensions: ['procedure', 'interaction', 'memory', 'personality'],
        enableConflictDetection: true
      }

      const distiller = createPersonaDistiller(config)

      const sessions: ChatSession[] = [
        createMockChatSession('zhangsan', '张三'),
        createMockChatSession('lisi', '李四')
      ]

      const messages: Message[] = [
        createMockMessage('zhangsan:1', 'zhangsan', '张三', '你好！', 0),
        createMockMessage('zhangsan:2', 'zhangsan', '张三', '今天天气不错', 0),
        createMockMessage('zhangsan:3', 'me', '我', '是啊', 1),
        createMockMessage('lisi:1', 'lisi', '李四', '消息', 0)
      ]

      const rawData = distiller.collectFromWeChat(sessions, messages, '张三')

      expect(rawData.sources).toHaveLength(1)
      expect(rawData.sources[0].platform).toBe('wechat')
      expect(rawData.sources[0].name).toContain('张三')
      expect(rawData.messages.length).toBeGreaterThanOrEqual(2)
    })

    it('应该正确筛选目标人物的消息', () => {
      const config: DistillationConfig = {
        targetPerson: '王五',
        role: 'colleague',
        selectedDimensions: ['procedure', 'interaction'],
        enableConflictDetection: false
      }

      const distiller = createPersonaDistiller(config)

      const sessions: ChatSession[] = [
        createMockChatSession('wangwu', '王五'),
        createMockChatSession('zhaoliu', '赵六')
      ]

      const messages: Message[] = [
        createMockMessage('wangwu:1', 'wangwu', '王五', '王五的消息', 0),
        createMockMessage('wangwu:2', 'wangwu', '王五', '王五的第二个消息', 0),
        createMockMessage('zhaoliu:1', 'zhaoliu', '赵六', '赵六的消息', 0)
      ]

      const rawData = distiller.collectFromWeChat(sessions, messages, '王五')

      const targetMessages = rawData.messages.filter(m => m.isTarget)
      expect(targetMessages.length).toBeGreaterThanOrEqual(2)
    })

    it('应该正确处理空数据', () => {
      const config: DistillationConfig = {
        targetPerson: '测试人物',
        role: 'self',
        selectedDimensions: ['procedure'],
        enableConflictDetection: true
      }

      const distiller = createPersonaDistiller(config)

      const rawData = distiller.collectFromWeChat([], [], '不存在')

      expect(rawData.messages).toHaveLength(0)
      expect(rawData.metadata.totalMessages).toBe(0)
      expect(rawData.metadata.participants).toHaveLength(0)
    })

    it('应该正确处理日期范围元数据', () => {
      const config: DistillationConfig = {
        targetPerson: '测试',
        role: 'friend',
        selectedDimensions: ['interaction'],
        enableConflictDetection: false
      }

      const distiller = createPersonaDistiller(config)

      const sessions: ChatSession[] = [
        createMockChatSession('user1', '用户1')
      ]

      const messages: Message[] = [
        { ...createMockMessage('user1:1', 'user1', '用户1', '消息1', 0), createTime: 1000000000000 },
        { ...createMockMessage('user1:2', 'user1', '用户1', '消息2', 0), createTime: 1000000001000 }
      ]

      const rawData = distiller.collectFromWeChat(sessions, messages, '用户1')

      expect(rawData.metadata.dateRange.start).toBe(1000000000000)
      expect(rawData.metadata.dateRange.end).toBe(1000000001000)
    })
  })

  describe('人格蒸馏功能', () => {
    it('应该生成正确的基础 Persona', async () => {
      const config: DistillationConfig = {
        targetPerson: '李明',
        role: 'colleague',
        selectedDimensions: ['procedure', 'interaction'],
        enableConflictDetection: true
      }

      const distiller = createPersonaDistiller(config)

      const rawData: RawCollectedData = {
        messages: [],
        sources: [{
          id: 'source-1',
          platform: 'wechat',
          name: '微信 - 李明',
          collectedAt: Date.now(),
          itemsCount: 0
        }],
        metadata: {
          totalMessages: 0,
          dateRange: { start: Date.now(), end: Date.now() },
          participants: []
        }
      }

      const persona = await distiller.distill(rawData)

      expect(persona.name).toBe('李明')
      expect(persona.role).toBe('colleague')
      expect(persona.slug).toBe('')
      expect(persona.sources).toHaveLength(1)
      expect(persona.manifest?.kitVersion).toBe('2.0.0')
    })

    it('应该为每个选定的维度生成数据', async () => {
      const config: DistillationConfig = {
        targetPerson: '王芳',
        role: 'friend',
        selectedDimensions: ['procedure', 'interaction', 'memory', 'personality'],
        enableConflictDetection: false
      }

      const distiller = createPersonaDistiller(config)

      const rawData: RawCollectedData = {
        messages: [
          { id: '1', content: '记得那次我们一起旅行', sender: '王芳', timestamp: Date.now(), isTarget: true },
          { id: '2', content: '工作流程应该是先规划再执行', sender: '王芳', timestamp: Date.now(), isTarget: true },
          { id: '3', content: '我通常怎么做的呢', sender: '王芳', timestamp: Date.now(), isTarget: true }
        ],
        sources: [{
          id: 'source-1',
          platform: 'wechat',
          name: '微信',
          collectedAt: Date.now(),
          itemsCount: 3
        }],
        metadata: {
          totalMessages: 3,
          dateRange: { start: Date.now(), end: Date.now() },
          participants: ['王芳']
        }
      }

      const persona = await distiller.distill(rawData)

      expect(persona.dimensions.procedure).toBeDefined()
      expect(persona.dimensions.interaction).toBeDefined()
      expect(persona.dimensions.memory).toBeDefined()
      expect(persona.dimensions.personality).toBeDefined()
    })

    it('应该正确启用冲突检测', async () => {
      const config: DistillationConfig = {
        targetPerson: '测试',
        role: 'self',
        selectedDimensions: ['procedure'],
        enableConflictDetection: true
      }

      const distiller = createPersonaDistiller(config)

      const rawData: RawCollectedData = {
        messages: [],
        sources: [],
        metadata: {
          totalMessages: 0,
          dateRange: { start: Date.now(), end: Date.now() },
          participants: []
        }
      }

      const persona = await distiller.distill(rawData)

      expect(persona.conflicts).toBeDefined()
      expect(Array.isArray(persona.conflicts)).toBe(true)
    })
  })

  describe('维度提取功能', () => {
    it('应该正确处理 procedure 维度提取', async () => {
      const config: DistillationConfig = {
        targetPerson: '张总',
        role: 'colleague',
        selectedDimensions: ['procedure'],
        enableConflictDetection: false
      }

      const distiller = createPersonaDistiller(config)

      const rawData: RawCollectedData = {
        messages: [
          { id: '1', content: '工作步骤应该是：先分析，再计划，然后执行', sender: '张总', timestamp: Date.now(), isTarget: true },
          { id: '2', content: '我们需要先明确目标', sender: '张总', timestamp: Date.now(), isTarget: true }
        ],
        sources: [{
          id: 'source-1',
          platform: 'wechat',
          name: '微信',
          collectedAt: Date.now(),
          itemsCount: 2
        }],
        metadata: {
          totalMessages: 2,
          dateRange: { start: Date.now(), end: Date.now() },
          participants: ['张总']
        }
      }

      const persona = await distiller.distill(rawData)

      expect(persona.dimensions.procedure?.content).toContain('程序性知识')
      expect(persona.dimensions.procedure?.evidence.length).toBeGreaterThan(0)
    })

    it('应该正确处理 interaction 维度提取', async () => {
      const config: DistillationConfig = {
        targetPerson: '小李',
        role: 'friend',
        selectedDimensions: ['interaction'],
        enableConflictDetection: false
      }

      const distiller = createPersonaDistiller(config)

      const rawData: RawCollectedData = {
        messages: [
          { id: '1', content: '最近怎么样？', sender: '小李', timestamp: Date.now(), isTarget: true },
          { id: '2', content: '你有什么想法吗？', sender: '小李', timestamp: Date.now(), isTarget: true }
        ],
        sources: [{
          id: 'source-1',
          platform: 'wechat',
          name: '微信',
          collectedAt: Date.now(),
          itemsCount: 2
        }],
        metadata: {
          totalMessages: 2,
          dateRange: { start: Date.now(), end: Date.now() },
          participants: ['小李']
        }
      }

      const persona = await distiller.distill(rawData)

      expect(persona.dimensions.interaction?.content).toContain('互动与态度')
      expect(persona.dimensions.interaction?.evidence.length).toBeGreaterThan(0)
    })

    it('应该正确处理 memory 维度提取', async () => {
      const config: DistillationConfig = {
        targetPerson: '老王',
        role: 'family',
        selectedDimensions: ['memory'],
        enableConflictDetection: false
      }

      const distiller = createPersonaDistiller(config)

      const rawData: RawCollectedData = {
        messages: [
          { id: '1', content: '记得那年我们去海边', sender: '老王', timestamp: Date.now(), isTarget: true },
          { id: '2', content: '以前我们常去那家餐厅', sender: '老王', timestamp: Date.now(), isTarget: true }
        ],
        sources: [{
          id: 'source-1',
          platform: 'wechat',
          name: '微信',
          collectedAt: Date.now(),
          itemsCount: 2
        }],
        metadata: {
          totalMessages: 2,
          dateRange: { start: Date.now(), end: Date.now() },
          participants: ['老王']
        }
      }

      const persona = await distiller.distill(rawData)

      expect(persona.dimensions.memory?.content).toContain('记忆与经历')
      expect(persona.dimensions.memory?.evidence.length).toBeGreaterThan(0)
    })

    it('应该正确处理 personality 维度提取', async () => {
      const config: DistillationConfig = {
        targetPerson: '陈小姐',
        role: 'partner',
        selectedDimensions: ['personality'],
        enableConflictDetection: false
      }

      const distiller = createPersonaDistiller(config)

      const rawData: RawCollectedData = {
        messages: [
          { id: '1', content: '太棒了！谢谢你的帮助！', sender: '陈小姐', timestamp: Date.now(), isTarget: true },
          { id: '2', content: '哈哈哈，真有意思', sender: '陈小姐', timestamp: Date.now(), isTarget: true }
        ],
        sources: [{
          id: 'source-1',
          platform: 'wechat',
          name: '微信',
          collectedAt: Date.now(),
          itemsCount: 2
        }],
        metadata: {
          totalMessages: 2,
          dateRange: { start: Date.now(), end: Date.now() },
          participants: ['陈小姐']
        }
      }

      const persona = await distiller.distill(rawData)

      expect(persona.dimensions.personality?.content).toContain('性格与价值观')
    })
  })

  describe('边界情况和错误处理', () => {
    it('应该处理空消息数组', async () => {
      const config: DistillationConfig = {
        targetPerson: '空测试',
        role: 'self',
        selectedDimensions: ['procedure', 'interaction'],
        enableConflictDetection: true
      }

      const distiller = createPersonaDistiller(config)

      const rawData: RawCollectedData = {
        messages: [],
        sources: [{
          id: 'source-1',
          platform: 'wechat',
          name: '微信',
          collectedAt: Date.now(),
          itemsCount: 0
        }],
        metadata: {
          totalMessages: 0,
          dateRange: { start: Date.now(), end: Date.now() },
          participants: []
        }
      }

      const persona = await distiller.distill(rawData)

      expect(persona.dimensions.procedure?.content).toContain('数据不足')
      expect(persona.dimensions.interaction?.content).toContain('互动与态度')
    })

    it('应该正确处理超长消息内容', async () => {
      const config: DistillationConfig = {
        targetPerson: '长内容测试',
        role: 'self',
        selectedDimensions: ['interaction'],
        enableConflictDetection: false
      }

      const distiller = createPersonaDistiller(config)

      const longContent = 'A'.repeat(1000)
      const rawData: RawCollectedData = {
        messages: [
          { id: '1', content: longContent, sender: '测试', timestamp: Date.now(), isTarget: true }
        ],
        sources: [{
          id: 'source-1',
          platform: 'wechat',
          name: '微信',
          collectedAt: Date.now(),
          itemsCount: 1
        }],
        metadata: {
          totalMessages: 1,
          dateRange: { start: Date.now(), end: Date.now() },
          participants: ['测试']
        }
      }

      const persona = await distiller.distill(rawData)

      expect(persona.dimensions.interaction?.evidence[0].content.length).toBeLessThanOrEqual(200)
    })

    it('应该正确处理特殊字符', async () => {
      const config: DistillationConfig = {
        targetPerson: '特殊字符 @#$%',
        role: 'friend',
        selectedDimensions: ['procedure'],
        enableConflictDetection: false
      }

      const distiller = createPersonaDistiller(config)

      const rawData: RawCollectedData = {
        messages: [
          { id: '1', content: '测试 <script>alert("xss")</script>', sender: '用户', timestamp: Date.now(), isTarget: true }
        ],
        sources: [{
          id: 'source-1',
          platform: 'wechat',
          name: '微信',
          collectedAt: Date.now(),
          itemsCount: 1
        }],
        metadata: {
          totalMessages: 1,
          dateRange: { start: Date.now(), end: Date.now() },
          participants: ['用户']
        }
      }

      const persona = await distiller.distill(rawData)

      expect(persona.name).toBe('特殊字符 @#$%')
      expect(persona.slug).toBeDefined()
      expect(typeof persona.slug).toBe('string')
    })
  })

  describe('工厂函数', () => {
    it('createPersonaDistiller 应该创建新的实例', () => {
      const config: DistillationConfig = {
        targetPerson: '测试',
        role: 'self',
        selectedDimensions: [],
        enableConflictDetection: false
      }

      const distiller1 = createPersonaDistiller(config)
      const distiller2 = createPersonaDistiller(config)

      expect(distiller1).toBeInstanceOf(PersonaDistiller)
      expect(distiller2).toBeInstanceOf(PersonaDistiller)
      expect(distiller1).not.toBe(distiller2)
    })
  })
})
