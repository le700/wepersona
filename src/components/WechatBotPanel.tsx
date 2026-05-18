import React, { useState, useEffect } from 'react'
import { usePersonaStore } from '../stores/personaStore'
import { useAIConfigStore } from '../stores/aiConfigStore'
import { Bot, Power, RefreshCw, CheckCircle, XCircle, Settings, User, MessageSquare, Save } from 'lucide-react'
import './WechatBotPanel.scss'

type BotStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error' | 'unknown'

interface BotConfig {
  enabled: boolean
  whitelist: string[]
  replyPrefix: string
  autoReplyPrivate: boolean
  autoReplyGroup: boolean
  replyOnlyMentioned: boolean
  usePersona: boolean
  personaId: string | null
}

interface BotStatusData {
  status: BotStatus
  qrCode: string | null
  userInfo: {
    name: string
    id: string
  } | null
  error: string | null
}

const WechatBotPanel: React.FC = () => {
  const { personas, currentPersona } = usePersonaStore()
  const { isConfigured } = useAIConfigStore()
  const [status, setStatus] = useState<BotStatus>('unknown')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [userInfo, setUserInfo] = useState<{ name: string; id: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [config, setConfig] = useState<BotConfig>({
    enabled: false,
    whitelist: [],
    replyPrefix: '[AI] ',
    autoReplyPrivate: true,
    autoReplyGroup: true,
    replyOnlyMentioned: true,
    usePersona: true,
    personaId: null
  })
  const [whitelistInput, setWhitelistInput] = useState('')

  const electronAPI = (window as any).electronAPI

  useEffect(() => {
    if (electronAPI?.wechatBot) {
      // 初始化状态
      electronAPI.wechatBot.getStatus().then((statusData: BotStatusData) => {
        setStatus(statusData.status)
        setQrCode(statusData.qrCode)
        setUserInfo(statusData.userInfo)
        setError(statusData.error)
      })

      electronAPI.wechatBot.getConfig().then((savedConfig: BotConfig) => {
        if (savedConfig) {
          setConfig(savedConfig)
        }
      })

      const unsubscribeStatus = electronAPI.wechatBot.onStatus((statusData: BotStatusData) => {
        setStatus(statusData.status)
        setQrCode(statusData.qrCode)
        setUserInfo(statusData.userInfo)
        setError(statusData.error)
      })

      const unsubscribeQRCode = electronAPI.wechatBot.onQRCode((qr: string) => {
        setQrCode(qr)
      })

      const unsubscribeLogin = electronAPI.wechatBot.onLogin((info: any) => {
        setUserInfo(info)
        setQrCode(null)
      })

      const unsubscribeLogout = electronAPI.wechatBot.onLogout(() => {
        setUserInfo(null)
      })

      const unsubscribeError = electronAPI.wechatBot.onError((err: any) => {
        setError(typeof err === 'string' ? err : err?.message || '未知错误')
      })

      return () => {
        unsubscribeStatus?.()
        unsubscribeQRCode?.()
        unsubscribeLogin?.()
        unsubscribeLogout?.()
        unsubscribeError?.()
      }
    }
  }, [])

  const handleStart = async () => {
    if (electronAPI?.wechatBot) {
      try {
        await electronAPI.wechatBot.start()
        setError(null)
      } catch (err: any) {
        setError(err.message || '启动失败')
      }
    }
  }

  const handleStop = async () => {
    if (electronAPI?.wechatBot) {
      try {
        await electronAPI.wechatBot.stop()
      } catch (err: any) {
        setError(err.message || '停止失败')
      }
    }
  }

  const handleSaveConfig = async () => {
    if (electronAPI?.wechatBot) {
      try {
        await electronAPI.wechatBot.saveConfig(config)
        alert('配置已保存')
      } catch (err: any) {
        setError(err.message || '保存配置失败')
      }
    }
  }

  const handleAddToWhitelist = () => {
    if (whitelistInput.trim() && !config.whitelist.includes(whitelistInput.trim())) {
      setConfig(prev => ({
        ...prev,
        whitelist: [...prev.whitelist, whitelistInput.trim()]
      }))
      setWhitelistInput('')
    }
  }

  const handleRemoveFromWhitelist = (item: string) => {
    setConfig(prev => ({
      ...prev,
      whitelist: prev.whitelist.filter(i => i !== item)
    }))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddToWhitelist()
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'stopped': return '已停止'
      case 'starting': return '启动中...'
      case 'running': return '运行中'
      case 'stopping': return '停止中...'
      case 'error': return '错误'
      default: return '未知'
    }
  }

  const activePersona = currentPersona || personas.find(p => p.id === config.personaId)

  return (
    <div className="wechat-bot-panel">
      <div className="panel-header">
        <div className="header-left">
          <Bot size={24} className="header-icon" />
          <div>
            <h3>微信机器人</h3>
            <p>自动回复微信消息</p>
          </div>
        </div>
        <div className={`status-badge ${status}`}>
          {getStatusText()}
        </div>
      </div>

      <div className="panel-content">
        <div className="control-section">
          <div className="control-buttons">
            <button
              className="btn btn-start"
              onClick={handleStart}
              disabled={status === 'running' || status === 'starting'}
            >
              <Power size={16} />
              启动
            </button>
            <button
              className="btn btn-stop"
              onClick={handleStop}
              disabled={status === 'stopped' || status === 'stopping'}
            >
              <Power size={16} />
              停止
            </button>
          </div>
        </div>

        {qrCode && (
          <div className="qr-section">
            <h4>请扫描二维码登录</h4>
            <div className="qr-container">
              <img src={qrCode} alt="登录二维码" className="qr-image" />
            </div>
            <p className="qr-hint">使用微信扫描二维码登录</p>
          </div>
        )}

        {userInfo && (
          <div className="login-info">
            <CheckCircle size={20} className="success-icon" />
            <div>
              <h4>已登录</h4>
              <p>{userInfo.name} ({userInfo.id})</p>
            </div>
          </div>
        )}

        {error && (
          <div className="error-message">
            <XCircle size={20} />
            <p>{error}</p>
          </div>
        )}

        <div className="config-section">
          <h4><Settings size={18} /> 配置</h4>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={config.autoReplyPrivate}
                onChange={(e) => setConfig(prev => ({ ...prev, autoReplyPrivate: e.target.checked }))}
              />
              自动回复私聊消息
            </label>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={config.autoReplyGroup}
                onChange={(e) => setConfig(prev => ({ ...prev, autoReplyGroup: e.target.checked }))}
              />
              自动回复群聊消息
            </label>
          </div>

          {config.autoReplyGroup && (
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={config.replyOnlyMentioned}
                  onChange={(e) => setConfig(prev => ({ ...prev, replyOnlyMentioned: e.target.checked }))}
                />
                仅回复被@的消息
              </label>
            </div>
          )}

          <div className="form-group">
            <label>回复前缀</label>
            <input
              type="text"
              value={config.replyPrefix}
              onChange={(e) => setConfig(prev => ({ ...prev, replyPrefix: e.target.value }))}
              placeholder="例如: [AI] "
            />
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={config.usePersona}
                onChange={(e) => setConfig(prev => ({ ...prev, usePersona: e.target.checked }))}
              />
              使用数字人格回复
            </label>
          </div>

          {config.usePersona && (
            <div className="form-group persona-info">
              <label>当前人格</label>
              <div className="persona-display">
                {activePersona ? (
                  <>
                    <span className="persona-name">{activePersona.name}</span>
                    <span className="persona-role"> - {activePersona.role}</span>
                  </>
                ) : (
                  <span className="text-muted">未选择人格</span>
                )}
              </div>
            </div>
          )}

          <div className="form-group">
            <label>白名单 (仅回复这些联系人)</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input
                type="text"
                value={whitelistInput}
                onChange={(e) => setWhitelistInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="输入联系人名称或ID"
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-primary"
                onClick={handleAddToWhitelist}
                style={{ whiteSpace: 'nowrap' }}
              >
                添加
              </button>
            </div>
            {config.whitelist.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {config.whitelist.map((item, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 12px',
                      background: 'var(--bg-tertiary)',
                      borderRadius: '16px',
                      fontSize: '14px'
                    }}
                  >
                    <span>{item}</span>
                    <button
                      onClick={() => handleRemoveFromWhitelist(item)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px',
                        color: 'var(--text-secondary)',
                        fontSize: '16px'
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="hint">留空则回复所有消息</p>
          </div>

          <div className="save-section">
            <button className="btn btn-primary" onClick={handleSaveConfig}>
              <Save size={16} />
              保存配置
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WechatBotPanel
