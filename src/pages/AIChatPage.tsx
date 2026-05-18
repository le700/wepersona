import React, { useState, useRef, useEffect } from 'react'
import { Plus, MessageSquare, Send, Trash2, User, Bot, Sparkles, AlertCircle, Settings } from 'lucide-react'
import { useAIChatStore } from '../stores/aiChatStore'
import { usePersonaStore, personaRoles } from '../stores/personaStore'
import { useAIConfigStore } from '../stores/aiConfigStore'
import { useNavigate } from 'react-router-dom'
import './AIChatPage.scss'

function AIChatPage() {
  const navigate = useNavigate()
  const { 
    sessions, 
    currentSession, 
    createSession, 
    addMessage, 
    deleteSession, 
    selectSession, 
    generateResponse,
    isGenerating,
    error,
    setError
  } = useAIChatStore()
  const { personas, currentPersona, selectPersona } = usePersonaStore()
  const { isConfigured } = useAIConfigStore()
  const [inputMessage, setInputMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [currentSession?.messages])

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error, setError])

  const handleSend = async () => {
    if (!inputMessage.trim() || !currentSession || isGenerating) return

    addMessage(currentSession.id, {
      role: 'user',
      content: inputMessage.trim(),
      personaId: currentPersona?.id
    })
    setInputMessage('')

    await generateResponse(currentSession.id, currentPersona?.id)
  }

  const handleCreateSession = () => {
    const sessionName = `会话 ${sessions.length + 1}`
    createSession(sessionName, currentPersona?.id)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="ai-chat-page">
      <div className="chat-sidebar">
        <div className="sidebar-header">
          <h2 className="sidebar-title">AI 聊天</h2>
          <button className="new-chat-btn" onClick={handleCreateSession}>
            <Plus size={18} />
          </button>
        </div>

        {!isConfigured && (
          <div className="config-warning">
            <AlertCircle size={16} />
            <span>AI服务未配置</span>
            <button onClick={() => navigate('/settings')} className="mini-btn">
              <Settings size={14} />
            </button>
          </div>
        )}

        <div className="persona-selector">
          <label className="selector-label">当前人格</label>
          <select
            value={currentPersona?.id || ''}
            onChange={(e) => selectPersona(e.target.value)}
            className="persona-select"
          >
            <option value="">无（默认）</option>
            {personas.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {personaRoles.find((r) => r.id === persona.role)?.emoji} {persona.name}
              </option>
            ))}
          </select>
        </div>

        <div className="session-list">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`session-item ${currentSession?.id === session.id ? 'active' : ''}`}
              onClick={() => selectSession(session.id)}
            >
              <div className="session-icon">
                <MessageSquare size={16} />
              </div>
              <div className="session-info">
                <span className="session-name">{session.name}</span>
                {session.messages.length > 0 && (
                  <span className="session-preview">
                    {session.messages[session.messages.length - 1].content.slice(0, 30)}
                    {session.messages[session.messages.length - 1].content.length > 30 && '...'}
                  </span>
                )}
              </div>
              <button
                className="session-delete-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm('确定删除此会话？')) {
                    deleteSession(session.id)
                  }
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {sessions.length === 0 && (
            <div className="empty-sessions">
              <Sparkles size={32} className="empty-icon" />
              <p>暂无会话</p>
              <span>点击上方按钮开始新对话</span>
            </div>
          )}
        </div>
      </div>

      <div className="chat-main">
        {error && (
          <div className="error-banner">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="close-error">×</button>
          </div>
        )}

        {currentSession ? (
          <>
            <div className="chat-header">
              <div className="header-info">
                <MessageSquare size={20} className="header-icon" />
                <h3 className="chat-title">{currentSession.name}</h3>
                {currentPersona && (
                  <span className="current-persona">
                    {personaRoles.find((r) => r.id === currentPersona.role)?.emoji} {currentPersona.name}
                  </span>
                )}
              </div>
            </div>

            <div className="chat-messages">
              {currentSession.messages.map((message) => (
                <div
                  key={message.id}
                  className={`message ${message.role}`}
                >
                  <div className="message-avatar">
                    {message.role === 'user' ? (
                      <User size={24} />
                    ) : (
                      <Bot size={24} />
                    )}
                  </div>
                  <div className="message-content">
                    <div className="message-header">
                      <span className="message-role">
                        {message.role === 'user' ? '我' : 'AI'}
                      </span>
                      <span className="message-time">{formatTime(message.timestamp)}</span>
                    </div>
                    <div className="message-body">
                      <p>{message.content}</p>
                    </div>
                  </div>
                </div>
              ))}

              {isGenerating && (
                <div className="message assistant">
                  <div className="message-avatar">
                    <Bot size={24} />
                  </div>
                  <div className="message-content">
                    <div className="message-header">
                      <span className="message-role">AI</span>
                    </div>
                    <div className="message-body">
                      <div className="typing-indicator">
                        <span className="typing-dot"></span>
                        <span className="typing-dot"></span>
                        <span className="typing-dot"></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={!isConfigured ? "请先在设置中配置AI服务..." : "输入消息..."}
                className="message-input"
                disabled={isGenerating || !isConfigured}
              />
              <button
                className="send-btn"
                onClick={handleSend}
                disabled={!inputMessage.trim() || isGenerating || !isConfigured}
              >
                <Send size={18} />
              </button>
            </div>
          </>
        ) : (
          <div className="empty-chat">
            <MessageSquare size={64} className="empty-icon" />
            <h2>开始对话</h2>
            <p>创建一个新会话开始与AI聊天</p>
            {!isConfigured && (
              <p className="sub-note">请先在设置中配置AI服务</p>
            )}
            <button className="btn btn-primary" onClick={handleCreateSession}>
              <Plus size={18} />
              <span>新对话</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default AIChatPage
