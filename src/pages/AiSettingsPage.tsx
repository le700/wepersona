import React, { useState, useEffect } from 'react'
import { useAIConfigStore, servicePresets } from '../stores/aiConfigStore'
import { usePersonaStore } from '../stores/personaStore'
import { AIServiceManager } from '../services/ai/aiService'
import { Settings, Save, CheckCircle, ChevronDown, Eye, EyeOff, Bot, User, MessageSquare } from 'lucide-react'
import WechatBotPanel from '../components/WechatBotPanel'
import './AiSettingsPage.scss'

const AiSettingsPage: React.FC = () => {
  const { config, isConfigured, setConfig, updateConfig, clearConfig } = useAIConfigStore()
  const { personas, currentPersona, selectPersona } = usePersonaStore()
  const [showApiKey, setShowApiKey] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const serviceTypes = [
    { value: 'deepseek', label: 'DeepSeek', defaultUrl: 'https://api.deepseek.com', defaultModel: 'deepseek-chat' },
    { value: 'openai', label: 'OpenAI', defaultUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-3.5-turbo' },
    { value: 'ollama', label: 'Ollama', defaultUrl: 'http://localhost:11434', defaultModel: 'llama2' },
    { value: 'claude', label: 'Claude (Anthropic)', defaultUrl: 'https://api.anthropic.com', defaultModel: 'claude-3-sonnet-20240229' },
    { value: 'kimi', label: 'Kimi (月之暗面)', defaultUrl: 'https://api.moonshot.cn/v1', defaultModel: 'moonshot-v1-8k' },
    { value: 'doubao', label: '豆包 (火山引擎)', defaultUrl: 'https://ark.cn-beijing.volces.com/api/v3', defaultModel: 'ep-20240722143518-9s557' },
    { value: 'tongyi', label: '通义千问', defaultUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-plus' },
    { value: 'xunfei', label: '讯飞星火', defaultUrl: 'https://spark-api-open.xf-yun.com/v1', defaultModel: 'generalv3.5' },
    { value: '302ai', label: '302.AI', defaultUrl: 'https://api.302.ai/v1', defaultModel: 'gpt-4o-mini' },
  ]

  const [localConfig, setLocalConfig] = useState({
    serviceType: config?.serviceType || 'deepseek',
    apiKey: config?.apiKey || '',
    baseUrl: config?.baseUrl || 'https://api.deepseek.com',
    model: config?.model || 'deepseek-chat',
    systemMessage: config?.systemMessage || '你是一个友好的助手。',
  })

  useEffect(() => {
    if (config) {
      setLocalConfig({
        serviceType: config.serviceType,
        apiKey: config.apiKey || '',
        baseUrl: config.baseUrl || '',
        model: config.model || '',
        systemMessage: config.systemMessage || '你是一个友好的助手。',
      })
    }
  }, [config])

  const handleServiceTypeChange = (type: string) => {
    const preset = serviceTypes.find(s => s.value === type)
    if (preset) {
      setLocalConfig(prev => ({
        ...prev,
        serviceType: type as any,
        baseUrl: preset.defaultUrl,
        model: preset.defaultModel,
      }))
    }
  }

  const handleSave = () => {
    setConfig(localConfig as any)
    try {
      const aiManager = AIServiceManager.getInstance()
      aiManager.configure(localConfig as any)
      setTestResult({ success: true, message: '配置已保存并生效' })
      setTimeout(() => setTestResult(null), 3000)
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: `配置失败: ${error instanceof Error ? error.message : '未知错误'}` 
      })
    }
  }

  const handleTest = async () => {
    setIsTesting(true)
    setTestResult(null)
    
    try {
      const aiManager = AIServiceManager.getInstance()
      aiManager.configure(localConfig as any)
      
      const response = await aiManager.generateResponse([
        { role: 'user', content: '你好，请回复"测试成功"来确认连接正常。' }
      ])
      
      setTestResult({ 
        success: true, 
        message: `测试成功！AI 回复: ${response}` 
      })
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: `测试失败: ${error instanceof Error ? error.message : '未知错误'}` 
      })
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="ai-settings-page">
      <div className="settings-header">
        <h2><Settings size={24} /> AI 服务设置</h2>
        <p>配置你的 AI 服务提供商和参数</p>
      </div>

      <div className="settings-content">
        <div className="settings-grid">
          <div className="settings-main">
            <div className="setting-section">
              <h3>服务提供商</h3>
              <div className="form-group">
                <label>服务类型</label>
                <div className="custom-select">
                  <select
                    value={localConfig.serviceType}
                    onChange={(e) => handleServiceTypeChange(e.target.value)}
                  >
                    {serviceTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} />
                </div>
              </div>

              <div className="form-group">
                <label>API 密钥</label>
                <div className="password-input">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={localConfig.apiKey}
                    onChange={(e) => setLocalConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                    placeholder="输入你的 API 密钥"
                  />
                  <button 
                    className="toggle-visibility"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>API 地址 (Base URL)</label>
                <input
                  type="text"
                  value={localConfig.baseUrl}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
                  placeholder="API 基础地址"
                />
              </div>

              <div className="form-group">
                <label>模型名称</label>
                <input
                  type="text"
                  value={localConfig.model}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, model: e.target.value }))}
                  placeholder="模型名称"
                />
              </div>

              <div className="form-group">
                <label>系统提示词</label>
                <textarea
                  value={localConfig.systemMessage}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, systemMessage: e.target.value }))}
                  placeholder="定义 AI 的角色和行为"
                  rows={4}
                />
              </div>

              <div className="button-group">
                <button className="btn btn-primary" onClick={handleSave} disabled={isLoading}>
                  <Save size={18} />
                  保存配置
                </button>
                <button className="btn btn-secondary" onClick={handleTest} disabled={isTesting}>
              <CheckCircle size={18} />
              {isTesting ? '测试中...' : '测试连接'}
            </button>
              </div>

              {testResult && (
                <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                  {testResult.success ? (
                    <div className="success-icon">✓</div>
                  ) : (
                    <div className="error-icon">✗</div>
                  )}
                  <p>{testResult.message}</p>
                </div>
              )}
            </div>

            <div className="setting-section">
              <h3>人格设置</h3>
              <p>选择默认使用的数字人格进行对话</p>
              
              <div className="form-group">
                <label>默认人格</label>
                <div className="custom-select">
                  <select
                    value={currentPersona?.id || ''}
                    onChange={(e) => selectPersona(e.target.value)}
                  >
                    <option value="">不使用人格（默认）</option>
                    {personas.map(persona => (
                      <option key={persona.id} value={persona.id}>
                        {persona.name} ({persona.role})
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} />
                </div>
              </div>

              {personas.length === 0 && (
                <div className="empty-personas">
                  <User size={32} />
                  <p>还没有创建任何数字人格</p>
                  <p className="hint">去人格管理页面创建你的数字人格</p>
                </div>
              )}
            </div>
          </div>

          <div className="settings-sidebar">
            <WechatBotPanel />
          </div>
        </div>
      </div>
    </div>
  )
}

export default AiSettingsPage
