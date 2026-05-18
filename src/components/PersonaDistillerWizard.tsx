import React, { useState, useEffect } from 'react'
import { 
  ArrowRight, 
  Check, 
  User, 
  Settings, 
  Database, 
  Zap, 
  FileText, 
  Sparkles,
  ChevronLeft,
  ChevronRight,
  X,
  MessageSquare,
  Brain,
  Heart,
  BookOpen,
  Loader2
} from 'lucide-react'
import { 
  usePersonaStore, 
  personaRoles, 
  dataSourcePlatforms,
  dimensionConfig,
  PersonaRole
} from '../stores/personaStore'
import { createPersonaDistiller, DistillationConfig } from '../services/personaDistiller'
import { ChatSession, Message } from '../types/models'
import './PersonaDistillerWizard.scss'

interface PersonaDistillerWizardProps {
  onClose: () => void
  sessions?: ChatSession[]
  messages?: Message[]
}

type WizardStep = 'role' | 'target' | 'sources' | 'dimensions' | 'distilling' | 'review'

export function PersonaDistillerWizard({ onClose, sessions = [], messages = [] }: PersonaDistillerWizardProps) {
  const { addPersona, distillationProgress, updateDistillationProgress, resetDistillationProgress } = usePersonaStore()
  
  const [currentStep, setCurrentStep] = useState<WizardStep>('role')
  const [selectedRole, setSelectedRole] = useState<PersonaRole>('self')
  const [targetName, setTargetName] = useState('')
  const [selectedSources, setSelectedSources] = useState<string[]>(['wechat'])
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>([])
  const [generatedPersona, setGeneratedPersona] = useState<any>(null)
  const [selectedContact, setSelectedContact] = useState<string>('')
  
  // 步骤顺序
  const steps: WizardStep[] = ['role', 'target', 'sources', 'dimensions', 'distilling', 'review']
  
  // 根据角色自动选择默认维度
  useEffect(() => {
    const roleConfig = personaRoles.find(r => r.id === selectedRole)
    if (roleConfig) {
      setSelectedDimensions([...roleConfig.requiredDimensions, ...roleConfig.optionalDimensions])
    }
  }, [selectedRole])
  
  // 下一步
  const goToNextStep = () => {
    const currentIndex = steps.indexOf(currentStep)
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1])
    }
  }
  
  // 上一步
  const goToPreviousStep = () => {
    const currentIndex = steps.indexOf(currentStep)
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1])
    }
  }
  
  // 开始蒸馏
  const startDistillation = async () => {
    setCurrentStep('distilling')
    updateDistillationProgress({
      phase: 'collecting', currentStep: 1, message: '正在收集数据...' })
    
    try {
      // 模拟蒸馏过程
      setTimeout(() => {
        updateDistillationProgress({ phase: 'extracting', currentStep: 2, message: '正在提取维度...' })
      }, 1000)
      
      setTimeout(() => {
        updateDistillationProgress({ phase: 'merging', currentStep: 3, message: '正在合并数据...' })
      }, 2000)
      
      setTimeout(async () => {
        // 创建蒸馏配置
        const config: DistillationConfig = {
          targetPerson: targetName || '目标人物',
          role: selectedRole,
          selectedDimensions,
          enableConflictDetection: true
        }
        
        const distiller = createPersonaDistiller(config)
        
        // 收集数据（模拟或真实数据）
        const rawData = distiller.collectFromWeChat(sessions, messages, selectedContact || targetName)
        
        updateDistillationProgress({ phase: 'extracting', currentStep: 4, message: '正在生成 Persona...' })
        
        // 执行蒸馏
        const persona = await distiller.distill(rawData)
        setGeneratedPersona(persona)
        
        updateDistillationProgress({ 
          phase: 'complete', 
          currentStep: 5, 
          message: '蒸馏完成！' 
        })
        
        setTimeout(() => {
          setCurrentStep('review')
        }, 500)
      }, 3000)
      
    } catch (error) {
      updateDistillationProgress({ 
        phase: 'error', 
        message: error instanceof Error ? error.message : '蒸馏失败' 
      })
    }
  }
  
  // 保存 Persona
  const savePersona = () => {
    if (generatedPersona) {
      addPersona(generatedPersona)
      resetDistillationProgress()
      onClose()
    }
  }
  
  // 切换维度选择
  const toggleDimension = (dimensionId: string) => {
    setSelectedDimensions(prev => 
      prev.includes(dimensionId) 
        ? prev.filter(id => id !== dimensionId)
        : [...prev, dimensionId]
    )
  }
  
  return (
    <div className="persona-distiller-wizard">
      <div className="wizard-header">
        <div className="wizard-title">
          <Sparkles className="title-icon" />
          <h2>蒸馏数字人格</h2>
        </div>
        <button className="close-btn" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      
      {/* 进度条 */}
      <div className="progress-bar">
        {steps.slice(0, -2).map((step, index) => {
          const stepConfig = getStepConfig(step)
          const isComplete = steps.indexOf(currentStep) > index
          const isActive = steps.indexOf(currentStep) === index
          
          return (
            <React.Fragment key={step}>
              <div 
                className={`progress-step ${isComplete ? 'complete' : ''} ${isActive ? 'active' : ''}`}
              >
                <div className="step-icon">
                  {isComplete ? <Check size={16} /> : stepConfig.icon}
                </div>
                <span className="step-label">{stepConfig.label}</span>
              </div>
              {index < steps.slice(0, -2).length - 1 && (
                <div className={`progress-line ${isComplete ? 'complete' : ''}`} />
              )}
            </React.Fragment>
          )
        })}
      </div>
      
      {/* 步骤内容 */}
      <div className="wizard-content">
        {currentStep === 'role' && (
          <div className="step-role">
            <h3>选择角色类型</h3>
            <p className="step-description">请选择您要蒸馏的人物关系类型，这将影响蒸馏的维度和重点</p>
            
            <div className="role-grid">
              {personaRoles.map(role => (
              <div
                key={role.id}
                className={`role-card ${selectedRole === role.id ? 'selected' : ''}`}
                onClick={() => setSelectedRole(role.id)}
              >
                <div className="role-emoji">{role.emoji}</div>
                <div className="role-info">
                  <h4>{role.name}</h4>
                  <p>{role.description}</p>
                </div>
                {selectedRole === role.id && <Check className="check-icon" />}
              </div>
            ))}
            </div>
          </div>
        )}
        
        {currentStep === 'target' && (
          <div className="step-target">
            <h3>设置目标人物</h3>
            <p className="step-description">请输入要蒸馏的人物信息</p>
            
            <div className="form-group">
              <label>人物姓名</label>
              <input
                type="text"
                value={targetName}
                onChange={(e) => setTargetName(e.target.value)}
                placeholder="例如：张三"
                className="target-input"
              />
            </div>
            
            <div className="form-group">
              <label>选择微信联系人（可选）</label>
              <select 
                value={selectedContact}
                onChange={(e) => setSelectedContact(e.target.value)}
                className="contact-select"
              >
                <option value="">从会话列表选择...</option>
                {sessions.slice(0, 20).map(session => (
                  <option key={session.username} value={session.displayName || session.username}>
                    {session.displayName || session.username}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        
        {currentStep === 'sources' && (
          <div className="step-sources">
            <h3>选择数据来源</h3>
            <p className="step-description">选择用于蒸馏的数据来源平台</p>
            
            <div className="sources-grid">
              {dataSourcePlatforms.map(source => (
                <div
                  key={source.id}
                  className={`source-card ${selectedSources.includes(source.id) ? 'selected' : ''}`}
                  onClick={() => {
                    if (selectedSources.includes(source.id)) {
                      setSelectedSources(prev => prev.filter(id => id !== source.id))
                    } else {
                      setSelectedSources(prev => [...prev, source.id])
                    }
                  }}
                >
                  <div className="source-icon">{source.emoji}</div>
                  <div className="source-info">
                    <h4>{source.name}</h4>
                    <p>{source.description}</p>
                  </div>
                  {selectedSources.includes(source.id) && <Check className="check-icon" />}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {currentStep === 'dimensions' && (
          <div className="step-dimensions">
            <h3>选择蒸馏维度</h3>
            <p className="step-description">选择要提取的人格维度</p>
            
            <div className="dimensions-grid">
              {dimensionConfig.map(dimension => {
                const roleConfig = personaRoles.find(r => r.id === selectedRole)
                const isRequired = roleConfig?.requiredDimensions.includes(dimension.id)
                const isOptional = roleConfig?.optionalDimensions.includes(dimension.id)
                
                return (
                  <div
                    key={dimension.id}
                    className={`dimension-card ${
                      selectedDimensions.includes(dimension.id) ? 'selected' : ''} ${
                        isRequired ? 'required' : ''
                      }`}
                    onClick={() => !isRequired && toggleDimension(dimension.id)}
                  >
                    <div className="dimension-icon">{dimension.icon}</div>
                    <div className="dimension-info">
                      <h4>{dimension.name}</h4>
                      <p>{dimension.description}</p>
                      {isRequired && <span className="required-badge">必需</span>}
                    </div>
                    {selectedDimensions.includes(dimension.id) && <Check className="check-icon" />}
                  </div>
                )
              })}
            </div>
          </div>
        )}
        
        {currentStep === 'distilling' && (
          <div className="step-distilling">
            <div className="distilling-status">
              <Loader2 className="spinner" />
              <h3>正在蒸馏...</h3>
              <p className="status-message">{distillationProgress.message}</p>
              
              <div className="progress-indicator">
                {[1, 2, 3, 4, 5].map(step => (
                  <div 
                    key={step}
                    className={`progress-dot ${
                      step <= distillationProgress.currentStep ? 'active' : ''
                    }`}
                  />
                ))}
              </div>
              
              <div className="phase-labels">
                <span className={distillationProgress.phase === 'collecting' ? 'active' : ''}>
                  收集数据
                </span>
                <span className={distillationProgress.phase === 'extracting' ? 'active' : ''}>
                  提取维度
                </span>
                <span className={distillationProgress.phase === 'merging' ? 'active' : ''}>
                  合并冲突
                </span>
                <span className={distillationProgress.phase === 'complete' ? 'active' : ''}>
                  完成
                </span>
              </div>
            </div>
          </div>
        )}
        
        {currentStep === 'review' && generatedPersona && (
          <div className="step-review">
            <h3>蒸馏完成！</h3>
            <p className="step-description">请检查生成的数字人格，满意后保存</p>
            
            <div className="persona-preview">
              <div className="preview-header">
                <div className="preview-icon">
                  {personaRoles.find(r => r.id === generatedPersona.role)?.emoji}
                </div>
                <div className="preview-info">
                  <h4>{generatedPersona.name}</h4>
                  <span>{personaRoles.find(r => r.id === generatedPersona.role)?.name}</span>
                </div>
              </div>
              
              <div className="preview-dimensions">
                {Object.entries(generatedPersona.dimensions).map(([dimId, dimData]) => {
                  if (!dimData) return null
                  const dimConfig = dimensionConfig.find(d => d.id === dimId)
                  const typedDimData = dimData as { evidence?: any[]; content?: string }
                  return (
                    <div key={dimId} className="preview-dimension">
                      <div className="dim-header">
                        <span className="dim-icon">{dimConfig?.icon}</span>
                        <span className="dim-name">{dimConfig?.name}</span>
                        <span className="dim-evidence-count">
                          {typedDimData.evidence?.length || 0} 条证据
                        </span>
                      </div>
                      <div className="dim-content">
                        {(typedDimData.content || '').substring(0, 200)}...
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* 底部操作按钮 */}
      <div className="wizard-footer">
        {currentStep !== 'distilling' && (
        <>
          {currentStep !== 'role' && currentStep !== 'review' && (
            <button className="btn btn-secondary" onClick={goToPreviousStep}>
              <ChevronLeft size={16} />
              上一步
            </button>
          )}
          
          {currentStep !== 'review' ? (
            <button 
              className="btn btn-primary" 
              onClick={currentStep === 'dimensions' ? startDistillation : goToNextStep}
              disabled={
                (currentStep === 'target' && !targetName) ||
                (currentStep === 'sources' && selectedSources.length === 0)
              }
            >
              {currentStep === 'dimensions' ? (
                <>
                  <Zap size={16} />
                  开始蒸馏
                </>
              ) : (
                <>
                  下一步
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={savePersona}>
              <Check size={16} />
              保存 Persona
            </button>
          )}
        </>
      )}
      </div>
    </div>
  )
}

// 步骤配置
function getStepConfig(step: WizardStep) {
  const configs: Record<WizardStep, { label: string; icon: React.ReactNode }> = {
    role: { label: '角色', icon: <User size={16} /> },
    target: { label: '目标', icon: <MessageSquare size={16} /> },
    sources: { label: '来源', icon: <Database size={16} /> },
    dimensions: { label: '维度', icon: <Settings size={16} /> },
    distilling: { label: '蒸馏', icon: <Zap size={16} /> },
    review: { label: '确认', icon: <FileText size={16} /> }
  }
  return configs[step]
}
