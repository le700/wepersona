/**
 * 微信机器人服务
 * 基于 wechaty 实现微信消息自动回复功能
 */

import { ipcMain, app } from 'electron'
import Store from 'electron-store'
import path from 'path'
import { fileURLToPath } from 'url'

// 动态导入 wechaty 相关模块（避免 TypeScript 编译问题）
let Wechaty: any
let WechatyBuilder: any
let ScanStatus: any
let qrcodeTerminal: any

// 机器人实例
let bot: any = null
let isBotRunning = false
let botStatus = 'stopped' // stopped, starting, running, stopping, error
let qrCodeUrl = ''
let loginUser: any = null
let errorMessage = ''

// 配置存储
const store = new Store()

// 机器人配置
interface BotConfig {
  enabled: boolean
  autoReply: boolean
  autoReplyPrefix: string
  serviceType: string
  apiKey: string
  baseUrl: string
  model: string
  systemMessage: string
  botName: string
  aliasWhitelist: string[]
  roomWhitelist: string[]
  usePersona: boolean
  personaId?: string
}

const defaultConfig: BotConfig = {
  enabled: false,
  autoReply: true,
  autoReplyPrefix: '',
  serviceType: 'deepseek',
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  systemMessage: '你是一个友好的助手。',
  botName: 'AI助手',
  aliasWhitelist: [],
  roomWhitelist: [],
  usePersona: false,
}

// 获取配置
function getConfig(): BotConfig {
  const stored = store.get('wechatBotConfig') as Partial<BotConfig>
  return { ...defaultConfig, ...stored }
}

// 保存配置
function saveConfig(config: Partial<BotConfig>) {
  const current = getConfig()
  const newConfig = { ...current, ...config }
  store.set('wechatBotConfig', newConfig)
  return newConfig
}

// AI 服务管理器（简化版，用于 Node.js 环境）
class AIServiceManager {
  private config: any
  
  constructor(config: any) {
    this.config = config
  }
  
  async generateResponse(messages: any[]): Promise<string> {
    try {
      // 根据服务类型选择不同的实现
      switch (this.config.serviceType) {
        case 'ollama':
          return await this.callOllama(messages)
        case 'deepseek':
        case 'openai':
        default:
          return await this.callOpenAICompatible(messages)
      }
    } catch (error) {
      console.error('AI 服务调用失败:', error)
      return '抱歉，AI 服务暂时不可用，请稍后再试。'
    }
  }
  
  private async callOpenAICompatible(messages: any[]): Promise<string> {
    const { default: fetch } = await import('node-fetch')
    
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: this.config.systemMessage },
          ...messages,
        ],
        temperature: 0.7,
      }),
    })
    
    if (!response.ok) {
      throw new Error(`API 请求失败: ${response.status}`)
    }
    
    const data = await response.json() as any
    return data.choices?.[0]?.message?.content || '抱歉，我无法生成回复。'
  }
  
  private async callOllama(messages: any[]): Promise<string> {
    const { default: fetch } = await import('node-fetch')
    
    const response = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: this.config.systemMessage },
          ...messages,
        ],
        stream: false,
      }),
    })
    
    if (!response.ok) {
      throw new Error(`Ollama 请求失败: ${response.status}`)
    }
    
    const data = await response.json() as any
    return data.message?.content || '抱歉，我无法生成回复。'
  }
}

// 处理微信消息
async function handleMessage(message: any) {
  const config = getConfig()
  
  if (!config.enabled || !config.autoReply) {
    return
  }
  
  try {
    const contact = message.talker()
    const room = message.room()
    const text = message.text()
    
    // 忽略自己发送的消息
    if (contact.self()) {
      return
    }
    
    // 只处理文本消息
    if (message.type() !== bot.Message.Type.Text) {
      return
    }
    
    let shouldReply = false
    let replyTarget: any = null
    let processedText = text
    
    if (room) {
      // 群聊消息
      const roomName = await room.topic()
      
      // 检查是否在白名单中
      if (config.roomWhitelist.length > 0 && !config.roomWhitelist.includes(roomName)) {
        return
      }
      
      // 检查是否艾特了机器人或包含前缀
      const mentionSelf = await message.mentionSelf()
      const hasBotName = text.includes(config.botName)
      const hasPrefix = config.autoReplyPrefix && text.startsWith(config.autoReplyPrefix)
      
      if (mentionSelf || hasBotName || hasPrefix) {
        shouldReply = true
        replyTarget = room
        
        // 移除艾特和前缀
        if (hasPrefix) {
          processedText = text.replace(config.autoReplyPrefix, '').trim()
        } else {
          // 移除艾特文本
          processedText = text.replace(`@${config.botName}`, '').replace(config.botName, '').trim()
        }
      }
    } else {
      // 私聊消息
      const alias = await contact.alias() || await contact.name()
      
      // 检查白名单
      if (config.aliasWhitelist.length > 0 && !config.aliasWhitelist.includes(alias)) {
        return
      }
      
      // 检查前缀（如果设置了）
      if (config.autoReplyPrefix && !text.startsWith(config.autoReplyPrefix)) {
        return
      }
      
      shouldReply = true
      replyTarget = contact
      
      // 移除前缀
      if (config.autoReplyPrefix) {
        processedText = text.replace(config.autoReplyPrefix, '').trim()
      }
    }
    
    if (!shouldReply || !processedText) {
      return
    }
    
    console.log(`收到消息: ${processedText}`)
    
    // 调用 AI 生成回复
    const aiManager = new AIServiceManager(config)
    const reply = await aiManager.generateResponse([
      { role: 'user', content: processedText }
    ])
    
    console.log(`AI 回复: ${reply}`)
    
    // 发送回复
    if (room) {
      await room.say(reply)
    } else {
      await contact.say(reply)
    }
    
  } catch (error) {
    console.error('处理消息时出错:', error)
  }
}

// 创建并启动机器人
async function startBot() {
  if (isBotRunning) {
    return { success: false, message: '机器人已在运行中' }
  }
  
  try {
    botStatus = 'starting'
    errorMessage = ''
    broadcastStatus()
    
    // 动态导入依赖
    const wechatyModule = await import('wechaty')
    const puppetModule = await import('wechaty-puppet-wechat4u')
    
    Wechaty = wechatyModule.Wechaty
    WechatyBuilder = wechatyModule.WechatyBuilder
    ScanStatus = wechatyModule.ScanStatus
    qrcodeTerminal = await import('qrcode-terminal')
    
    const config = getConfig()
    
    bot = WechatyBuilder.build({
      name: 'WePersonaBot',
      puppet: 'wechaty-puppet-wechat4u',
      puppetOptions: {
        uos: true,
      },
    })
    
    // 扫码事件
    bot.on('scan', (qrcode: string, status: any) => {
      if (status === ScanStatus.Waiting || status === ScanStatus.Timeout) {
        qrcodeTerminal.generate(qrcode, { small: true })
        qrCodeUrl = `https://wechaty.js.org/qrcode/${encodeURIComponent(qrcode)}`
        console.log('扫码登录:', qrCodeUrl)
        broadcastStatus()
      } else {
        console.log('扫码状态:', ScanStatus[status], status)
      }
    })
    
    // 登录事件
    bot.on('login', (user: any) => {
      loginUser = user
      botStatus = 'running'
      qrCodeUrl = ''
      console.log(`${user} 已登录`)
      broadcastStatus()
    })
    
    // 登出事件
    bot.on('logout', (user: any) => {
      loginUser = null
      botStatus = 'stopped'
      console.log(`${user} 已登出`)
      broadcastStatus()
    })
    
    // 消息事件
    bot.on('message', handleMessage)
    
    // 错误事件
    bot.on('error', (error: any) => {
      console.error('机器人错误:', error)
      errorMessage = error.message || '未知错误'
      botStatus = 'error'
      broadcastStatus()
    })
    
    await bot.start()
    isBotRunning = true
    
    return { success: true, message: '机器人启动成功' }
  } catch (error) {
    console.error('启动机器人失败:', error)
    botStatus = 'error'
    errorMessage = error instanceof Error ? error.message : '启动失败'
    broadcastStatus()
    return { success: false, message: errorMessage }
  }
}

// 停止机器人
async function stopBot() {
  if (!isBotRunning || !bot) {
    return { success: false, message: '机器人未在运行' }
  }
  
  try {
    botStatus = 'stopping'
    broadcastStatus()
    
    await bot.stop()
    isBotRunning = false
    botStatus = 'stopped'
    loginUser = null
    qrCodeUrl = ''
    broadcastStatus()
    
    return { success: true, message: '机器人已停止' }
  } catch (error) {
    console.error('停止机器人失败:', error)
    botStatus = 'error'
    errorMessage = error instanceof Error ? error.message : '停止失败'
    broadcastStatus()
    return { success: false, message: errorMessage }
  }
}

// 广播状态到渲染进程
function broadcastStatus() {
  const mainWindow = getMainWindow()
  if (mainWindow) {
    const statusData = getStatus()
    mainWindow.webContents.send('wechatbot:status', {
      status: statusData.status,
      qrCode: statusData.qrCodeUrl || null,
      userInfo: statusData.loginUser,
      error: statusData.errorMessage || null
    })
  }
}

// 获取主窗口（从全局变量查找）
function getMainWindow() {
  const BrowserWindow = require('electron').BrowserWindow
  const windows = BrowserWindow.getAllWindows()
  return windows.find(w => w.webContents.getURL().includes('index.html')) || windows[0]
}

// 获取当前状态
function getStatus() {
  return {
    status: botStatus,
    isRunning: isBotRunning,
    qrCodeUrl,
    loginUser: loginUser ? { name: loginUser.name() } : null,
    errorMessage,
    config: getConfig(),
  }
}

// 注册 IPC 处理器
export function registerWechatBotHandlers() {
  // 获取状态
  ipcMain.handle('wechatbot:get-status', () => {
    const statusData = getStatus()
    return {
      status: statusData.status,
      qrCode: statusData.qrCodeUrl || null,
      userInfo: statusData.loginUser,
      error: statusData.errorMessage || null
    }
  })
  
  // 启动机器人
  ipcMain.handle('wechatbot:start', async () => {
    const result = await startBot()
    return result
  })
  
  // 停止机器人
  ipcMain.handle('wechatbot:stop', async () => {
    const result = await stopBot()
    return result
  })
  
  // 获取配置
  ipcMain.handle('wechatbot:get-config', () => {
    const config = getConfig()
    // 转换配置格式以匹配前端期望
    return {
      enabled: config.enabled,
      whitelist: [...config.aliasWhitelist, ...config.roomWhitelist],
      replyPrefix: config.autoReplyPrefix,
      autoReplyPrivate: config.autoReply,
      autoReplyGroup: config.autoReply,
      replyOnlyMentioned: true,
      usePersona: config.usePersona,
      personaId: config.personaId || null
    }
  })
  
  // 保存配置
  ipcMain.handle('wechatbot:save-config', async (_, config: any) => {
    // 转换配置格式
    const botConfig: Partial<BotConfig> = {
      enabled: config.enabled,
      autoReplyPrefix: config.replyPrefix,
      autoReply: config.autoReplyPrivate || config.autoReplyGroup,
      usePersona: config.usePersona,
      personaId: config.personaId,
      aliasWhitelist: config.whitelist || [],
      roomWhitelist: config.whitelist || []
    }
    
    const newConfig = saveConfig(botConfig)
    return { success: true, config: newConfig }
  })
}

// 应用退出时清理
app.on('before-quit', async () => {
  if (isBotRunning && bot) {
    try {
      await bot.stop()
    } catch (error) {
      console.error('退出时停止机器人失败:', error)
    }
  }
})
