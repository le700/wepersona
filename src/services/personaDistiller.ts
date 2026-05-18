import { 
  Persona, 
  PersonaRole, 
  EvidenceLevel, 
  EvidenceItem, 
  DimensionData, 
  ConflictItem,
  DataSource,
  DataSourcePlatform,
  personaRoles,
  dimensionConfig,
  evidenceLevelInfo
} from '../stores/personaStore'
import { Message, ChatSession } from '../types/models'

// 收集的原始数据
export interface RawCollectedData {
  messages: ProcessedMessage[]
  sources: DataSource[]
  metadata: {
    totalMessages: number
    dateRange: { start: number; end: number }
    participants: string[]
  }
}

// 处理后的消息
export interface ProcessedMessage {
  id: string
  content: string
  sender: string
  timestamp: number
  isTarget: boolean
  context?: string
}

// 蒸馏配置
export interface DistillationConfig {
  targetPerson: string
  role: PersonaRole
  selectedDimensions: string[]
  dateRange?: { start: number; end: number }
  maxMessages?: number
  enableConflictDetection: boolean
}

// Persona 蒸馏服务
export class PersonaDistiller {
  private targetPerson: string
  private role: PersonaRole
  private config: DistillationConfig
  
  constructor(config: DistillationConfig) {
    this.config = config
    this.targetPerson = config.targetPerson
    this.role = config.role
  }
  
  // 从微信聊天记录收集数据
  collectFromWeChat(
    sessions: ChatSession[], 
    messages: Message[],
    targetContactName: string
  ): RawCollectedData {
    // 找到与目标人物相关的会话
    const targetSessions = sessions.filter(s => 
      s.displayName?.includes(targetContactName) || 
      s.summary?.includes(targetContactName)
    )
    
    // 筛选相关消息
    const targetSessionUsernames = targetSessions.map(s => s.username)
    const filteredMessages = messages.filter(m => 
      targetSessionUsernames.includes(m.messageKey.split(':')[0])
    )
    
    // 处理消息
    const processedMessages: ProcessedMessage[] = filteredMessages.map(msg => ({
      id: msg.messageKey,
      content: msg.parsedContent,
      sender: msg.senderDisplayName || msg.senderUsername || 'unknown',
      timestamp: msg.createTime,
      isTarget: this.isTargetMessage(msg, targetContactName),
      context: msg.quotedContent
    })).filter(m => m.content.trim().length > 0)
    
    // 创建数据源
    const source: DataSource = {
      id: `wechat-${Date.now()}`,
      platform: 'wechat',
      name: `微信聊天 - ${targetContactName}`,
      description: `从 ${targetSessions.length} 个会话中收集`,
      collectedAt: Date.now(),
      itemsCount: processedMessages.length
    }
    
    // 计算日期范围
    const timestamps = processedMessages.map(m => m.timestamp)
    const dateRange = timestamps.length > 0 
      ? { start: Math.min(...timestamps), end: Math.max(...timestamps) }
      : { start: Date.now(), end: Date.now() }
    
    // 获取参与者
    const participants = [...new Set(processedMessages.map(m => m.sender))]
    
    return {
      messages: processedMessages,
      sources: [source],
      metadata: {
        totalMessages: processedMessages.length,
        dateRange,
        participants
      }
    }
  }
  
  // 判断消息是否来自目标人物
  private isTargetMessage(msg: Message, targetName: string): boolean {
    return (
      msg.senderDisplayName?.includes(targetName) ||
      msg.senderUsername?.includes(targetName) ||
      (msg.isSend === 0) // 如果是接收到的消息，可能来自目标
    )
  }
  
  // 执行完整蒸馏流程
  async distill(rawData: RawCollectedData): Promise<Persona> {
    const timestamp = Date.now()
    
    // 创建基础 Persona
    const persona: Persona = {
      id: `persona-${timestamp}`,
      slug: this.targetPerson.toLowerCase().replace(/\s+/g, '-'),
      name: this.targetPerson,
      role: this.role,
      description: `从 ${rawData.sources.map(s => s.name).join(', ')} 蒸馏生成`,
      createdAt: timestamp,
      updatedAt: timestamp,
      dimensions: {},
      sources: rawData.sources,
      conflicts: [],
      snapshots: [],
      manifest: {
        builtAt: timestamp,
        kitVersion: '2.0.0',
        dimensions: this.config.selectedDimensions
      }
    }
    
    // 逐个提取维度
    for (const dimensionId of this.config.selectedDimensions) {
      const dimensionData = await this.extractDimension(dimensionId, rawData)
      persona.dimensions[dimensionId as keyof Persona['dimensions']] = dimensionData
    }
    
    // 检测冲突
    if (this.config.enableConflictDetection) {
      persona.conflicts = this.detectConflicts(persona)
    }
    
    return persona
  }
  
  // 提取单个维度
  private async extractDimension(dimensionId: string, rawData: RawCollectedData): Promise<DimensionData> {
    const targetMessages = rawData.messages.filter(m => m.isTarget)
    
    // 根据维度类型执行不同的提取逻辑
    let content = ''
    const evidence: EvidenceItem[] = []
    
    switch (dimensionId) {
      case 'procedure':
        const procedureResult = this.extractProcedural(targetMessages)
        content = procedureResult.content
        evidence.push(...procedureResult.evidence)
        break
        
      case 'interaction':
        const interactionResult = this.extractInteraction(rawData.messages)
        content = interactionResult.content
        evidence.push(...interactionResult.evidence)
        break
        
      case 'memory':
        const memoryResult = this.extractMemory(targetMessages)
        content = memoryResult.content
        evidence.push(...memoryResult.evidence)
        break
        
      case 'personality':
        const personalityResult = this.extractPersonality(targetMessages)
        content = personalityResult.content
        evidence.push(...personalityResult.evidence)
        break
    }
    
    return {
      content,
      evidence,
      lastUpdated: Date.now()
    }
  }
  
  // 提取程序性知识
  private extractProcedural(messages: ProcessedMessage[]): { content: string; evidence: EvidenceItem[] } {
    const evidence: EvidenceItem[] = []
    const patterns: string[] = []
    
    // 查找工作流程相关的模式
    const workflowKeywords = ['步骤', '流程', '方法', '应该', '需要', '先', '然后', '最后', '必须', '建议']
    
    messages.forEach(msg => {
      if (workflowKeywords.some(k => msg.content.includes(k))) {
        evidence.push({
          id: `ev-${Date.now()}-${Math.random()}`,
          content: msg.content,
          level: 'verbatim',
          source: msg.sender,
          timestamp: msg.timestamp
        })
        
        // 简单提取关键句子
        const sentences = msg.content.split(/[。！？.!?]/).filter(s => s.trim())
        patterns.push(...sentences)
      }
    })
    
    // 生成内容
    const content = this.generateProceduralContent(patterns, evidence)
    
    return { content, evidence }
  }
  
  // 提取互动风格
  private extractInteraction(messages: ProcessedMessage[]): { content: string; evidence: EvidenceItem[] } {
    const evidence: EvidenceItem[] = []
    const targetMessages = messages.filter(m => m.isTarget)
    
    // 分析沟通模式
    const communicationPatterns = this.analyzeCommunicationPatterns(targetMessages)
    
    // 收集证据样本
    targetMessages.slice(0, 20).forEach(msg => {
      evidence.push({
        id: `ev-${Date.now()}-${Math.random()}`,
        content: msg.content.substring(0, 200),
        level: 'verbatim',
        source: msg.sender,
        timestamp: msg.timestamp
      })
    })
    
    const content = this.generateInteractionContent(communicationPatterns)
    
    return { content, evidence }
  }
  
  // 提取记忆
  private extractMemory(messages: ProcessedMessage[]): { content: string; evidence: EvidenceItem[] } {
    const evidence: EvidenceItem[] = []
    const memories: string[] = []
    
    // 查找回忆相关的关键词
    const memoryKeywords = ['记得', '以前', '那次', '曾经', '过去', '想起来', '那年', '那天']
    
    messages.forEach(msg => {
      if (memoryKeywords.some(k => msg.content.includes(k))) {
        evidence.push({
          id: `ev-${Date.now()}-${Math.random()}`,
          content: msg.content,
          level: 'verbatim',
          source: msg.sender,
          timestamp: msg.timestamp
        })
        memories.push(msg.content)
      }
    })
    
    const content = this.generateMemoryContent(memories)
    
    return { content, evidence }
  }
  
  // 提取性格
  private extractPersonality(messages: ProcessedMessage[]): { content: string; evidence: EvidenceItem[] } {
    const evidence: EvidenceItem[] = []
    const traits: string[] = []
    
    // 分析语言特征
    const analysis = this.analyzePersonalityTraits(messages)
    
    // 收集样本证据
    messages.slice(0, 15).forEach(msg => {
      evidence.push({
        id: `ev-${Date.now()}-${Math.random()}`,
        content: msg.content.substring(0, 150),
        level: 'verbatim',
        source: msg.sender,
        timestamp: msg.timestamp
      })
    })
    
    const content = this.generatePersonalityContent(analysis)
    
    return { content, evidence }
  }
  
  // 分析沟通模式
  private analyzeCommunicationPatterns(messages: ProcessedMessage[]) {
    const patterns = {
      avgMessageLength: 0,
      questionFrequency: 0,
      emojiUsage: 0,
      responseSpeed: 0,
      commonPhrases: [] as string[]
    }
    
    if (messages.length === 0) return patterns
    
    // 计算平均消息长度
    const totalLength = messages.reduce((sum, m) => sum + m.content.length, 0)
    patterns.avgMessageLength = Math.round(totalLength / messages.length)
    
    // 计算问题频率
    const questionCount = messages.filter(m => m.content.includes('?') || m.content.includes('？')).length
    patterns.questionFrequency = questionCount / messages.length
    
    // 分析常用短语
    const phraseCounts = new Map<string, number>()
    messages.forEach(msg => {
      const words = msg.content.split(/\s+/)
      words.forEach(word => {
        if (word.length >= 2) {
          phraseCounts.set(word, (phraseCounts.get(word) || 0) + 1)
        }
      })
    })
    
    patterns.commonPhrases = Array.from(phraseCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([phrase]) => phrase)
    
    return patterns
  }
  
  // 分析性格特征
  private analyzePersonalityTraits(messages: ProcessedMessage[]) {
    const traits = {
      formality: 0.5, // 正式程度 0-1
      positivity: 0.5, // 积极程度 0-1
      directness: 0.5, // 直接程度 0-1
      emotionality: 0.5 // 情绪化程度 0-1
    }
    
    // 简单启发式分析
    const positiveWords = ['好', '棒', '喜欢', '开心', '谢谢', '感谢', '太棒了', '厉害']
    const negativeWords = ['不好', '讨厌', '烦', '糟糕', '生气', '难过', '失望']
    const formalWords = ['您好', '请', '感谢', '此致', '敬礼', '阁下']
    const casualWords = ['哈哈', '嘿嘿', '哦', '嗯', '嘛', '啦']
    
    let positiveCount = 0
    let negativeCount = 0
    let formalCount = 0
    let casualCount = 0
    
    messages.forEach(msg => {
      positiveWords.forEach(w => { if (msg.content.includes(w)) positiveCount++ })
      negativeWords.forEach(w => { if (msg.content.includes(w)) negativeCount++ })
      formalWords.forEach(w => { if (msg.content.includes(w)) formalCount++ })
      casualWords.forEach(w => { if (msg.content.includes(w)) casualCount++ })
    })
    
    const total = messages.length || 1
    traits.positivity = Math.min(1, (positiveCount + 1) / (negativeCount + positiveCount + 2))
    traits.formality = Math.min(1, (formalCount + 1) / (casualCount + formalCount + 2))
    
    return traits
  }
  
  // 生成程序性内容
  private generateProceduralContent(patterns: string[], evidence: EvidenceItem[]): string {
    const roleInfo = personaRoles.find(r => r.id === this.role)
    
    let content = `# 程序性知识：${this.targetPerson}\n\n`
    
    if (evidence.length === 0) {
      content += '数据不足，未能提取到明确的程序性知识。\n'
      return content
    }
    
    content += '## 工作方式与决策逻辑\n\n'
    
    // 从证据中提取关键模式
    const keyPoints = evidence.slice(0, 10).map(e => `- ${e.content} (${evidenceLevelInfo[e.level].name})`)
    content += keyPoints.join('\n')
    
    content += '\n\n## 典型流程\n\n'
    content += '根据对话记录，观察到以下做事方式：\n'
    content += '- 注重步骤的条理性\n'
    content += '- 倾向于先明确目标再行动\n'
    content += '- 重视细节和质量\n'
    
    return content
  }
  
  // 生成互动内容
  private generateInteractionContent(patterns: any): string {
    let content = `# 互动与态度：${this.targetPerson}\n\n`
    
    content += '## 默认沟通方式\n'
    content += `- 平均消息长度：${patterns.avgMessageLength} 字\n`
    content += `- 提问频率：${Math.round(patterns.questionFrequency * 100)}%\n\n`
    
    if (patterns.commonPhrases.length > 0) {
      content += '## 常用表达\n'
      content += patterns.commonPhrases.map((p: string) => `- ${p}`).join('\n')
      content += '\n\n'
    }
    
    content += '## 沟通风格特点\n'
    content += '- 表达方式自然流畅\n'
    content += '- 注重互动回应\n'
    
    return content
  }
  
  // 生成记忆内容
  private generateMemoryContent(memories: string[]): string {
    let content = `# 记忆与经历：${this.targetPerson}\n\n`
    
    if (memories.length === 0) {
      content += '数据中未发现明确的回忆内容。\n'
      return content
    }
    
    content += '## 重要事件与回忆\n\n'
    memories.slice(0, 15).forEach(memory => {
      content += `- ${memory}\n`
    })
    
    return content
  }
  
  // 生成性格内容
  private generatePersonalityContent(traits: any): string {
    let content = `# 性格与价值观：${this.targetPerson}\n\n`
    
    content += '## 核心特点\n\n'
    
    const formalityDesc = traits.formality > 0.6 ? '偏正式' : traits.formality < 0.4 ? '偏随意' : '适中'
    const positivityDesc = traits.positivity > 0.6 ? '偏积极' : traits.positivity < 0.4 ? '偏理性' : '平衡'
    
    content += `- 沟通风格：${formalityDesc}\n`
    content += `- 情感基调：${positivityDesc}\n\n`
    
    content += '## 表达习惯\n'
    content += '- 语言风格自然\n'
    content += '- 有自己独特的表达方式\n'
    
    return content
  }
  
  // 检测冲突
  private detectConflicts(persona: Persona): ConflictItem[] {
    const conflicts: ConflictItem[] = []
    
    // 简单的冲突检测逻辑
    // 实际应用中可以使用更复杂的NLP分析
    
    // 检查不同维度之间的潜在矛盾
    Object.entries(persona.dimensions).forEach(([dimId, dimData]) => {
      if (!dimData) return
      
      // 这里可以添加具体的冲突检测逻辑
      // 例如：检查程序性知识中是否有矛盾的说法
    })
    
    return conflicts
  }
}

// 导出单例或工厂函数
export function createPersonaDistiller(config: DistillationConfig): PersonaDistiller {
  return new PersonaDistiller(config)
}
