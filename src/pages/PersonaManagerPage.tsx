import React, { useState } from 'react'
import { Plus, Trash2, Edit2, X, Check, User, BookOpen, Heart, Brain, Zap, Sparkles, Clock, ShieldAlert } from 'lucide-react'
import { usePersonaStore, personaRoles, dimensionConfig, evidenceLevelInfo, type Persona, type PersonaRole } from '../stores/personaStore'
import { PersonaDistillerWizard } from '../components/PersonaDistillerWizard'
import './PersonaManagerPage.scss'

function PersonaManagerPage() {
  const { personas, currentPersona, addPersona, updatePersona, deletePersona, selectPersona, createSnapshot } = usePersonaStore()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDistillerWizard, setShowDistillerWizard] = useState(false)
  const [showEvidenceDetail, setShowEvidenceDetail] = useState<string | null>(null)
  const [showConflictDetail, setShowConflictDetail] = useState<string | null>(null)
  const [editingPersona, setEditingPersona] = useState<typeof currentPersona>(null)
  const [formData, setFormData] = useState({
    name: '',
    role: 'self' as PersonaRole,
    description: '',
    procedural: '',
    interaction: '',
    memory: '',
    personality: ''
  })

  const handleOpenCreate = () => {
    setFormData({
      name: '',
      role: 'self',
      description: '',
      procedural: '',
      interaction: '',
      memory: '',
      personality: ''
    })
    setShowCreateModal(true)
  }

  const handleOpenEdit = (persona: typeof currentPersona) => {
    if (!persona) return
    setEditingPersona(persona)
    setFormData({
      name: persona.name,
      role: persona.role,
      description: persona.description,
      procedural: persona.dimensions.procedural?.content || '',
      interaction: persona.dimensions.interaction?.content || '',
      memory: persona.dimensions.memory?.content || '',
      personality: persona.dimensions.personality?.content || ''
    })
    setShowEditModal(true)
  }

  const handleCreate = () => {
    addPersona({
      name: formData.name,
      role: formData.role,
      description: formData.description,
      dimensions: {
        procedural: formData.procedural ? {
          content: formData.procedural,
          evidence: [],
          lastUpdated: Date.now()
        } : undefined,
        interaction: formData.interaction ? {
          content: formData.interaction,
          evidence: [],
          lastUpdated: Date.now()
        } : undefined,
        memory: formData.memory ? {
          content: formData.memory,
          evidence: [],
          lastUpdated: Date.now()
        } : undefined,
        personality: formData.personality ? {
          content: formData.personality,
          evidence: [],
          lastUpdated: Date.now()
        } : undefined
      },
      sources: [],
      conflicts: [],
      snapshots: [],
      slug: formData.name.toLowerCase().replace(/\s+/g, '-')
    })
    setShowCreateModal(false)
  }

  const handleUpdate = () => {
    if (!editingPersona) return
    updatePersona(editingPersona.id, {
      name: formData.name,
      role: formData.role,
      description: formData.description,
      dimensions: {
        ...editingPersona.dimensions,
        procedural: formData.procedural ? {
          ...(editingPersona.dimensions.procedural || { evidence: [] }),
          content: formData.procedural,
          lastUpdated: Date.now()
        } : undefined,
        interaction: formData.interaction ? {
          ...(editingPersona.dimensions.interaction || { evidence: [] }),
          content: formData.interaction,
          lastUpdated: Date.now()
        } : undefined,
        memory: formData.memory ? {
          ...(editingPersona.dimensions.memory || { evidence: [] }),
          content: formData.memory,
          lastUpdated: Date.now()
        } : undefined,
        personality: formData.personality ? {
          ...(editingPersona.dimensions.personality || { evidence: [] }),
          content: formData.personality,
          lastUpdated: Date.now()
        } : undefined
      }
    })
    setShowEditModal(false)
    setEditingPersona(null)
  }

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这个数字人格吗？')) {
      deletePersona(id)
    }
  }

  const handleCreateSnapshot = (personaId: string) => {
    const note = prompt('请输入快照说明（可选）：', '手动保存')
    if (note !== null) {
      createSnapshot(personaId, note)
      alert('快照创建成功！')
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getRoleInfo = (role: PersonaRole) => personaRoles.find((r) => r.id === role) || personaRoles[0]

  const getDimensionIcon = (dimensionId: string) => {
    const config = dimensionConfig.find(d => d.id === dimensionId)
    return config?.icon || '📄'
  }

  const getDimensionName = (dimensionId: string) => {
    const config = dimensionConfig.find(d => d.id === dimensionId)
    return config?.name || dimensionId
  }

  return (
    <div className="persona-manager-page">
      <div className="page-header">
        <div className="header-content">
          <h1 className="page-title">数字人格管理</h1>
          <p className="page-subtitle">创建和管理您的数字人格，让 AI 拥有独特的个性和记忆</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={handleOpenCreate}>
            <Edit2 size={18} />
            <span>手动创建</span>
          </button>
          <button className="btn btn-primary" onClick={() => setShowDistillerWizard(true)}>
            <Zap size={18} />
            <Sparkles size={18} />
            <span>智能蒸馏</span>
          </button>
        </div>
      </div>

      <div className="persona-grid">
        {personas.map((persona) => (
          <div
            key={persona.id}
            className={`persona-card ${currentPersona?.id === persona.id ? 'active' : ''}`}
            onClick={() => selectPersona(persona.id)}
          >
            <div className="persona-header">
              <div className="persona-emoji">{getRoleInfo(persona.role).emoji}</div>
              <div className="persona-metadata">
                <span className="persona-sources">{persona.sources.length} 个来源</span>
                <span className="persona-snapshots">{persona.snapshots.length} 个快照</span>
                {persona.conflicts.length > 0 && (
                  <span className="persona-conflicts">
                    <ShieldAlert size={12} />
                    {persona.conflicts.length} 个冲突
                  </span>
                )}
              </div>
              <div className="persona-menu">
                <button onClick={(e) => { e.stopPropagation(); handleCreateSnapshot(persona.id) }} className="menu-btn">
                  <Clock size={14} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(persona) }} className="menu-btn">
                  <Edit2 size={14} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(persona.id) }} className="menu-btn delete">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="persona-info">
              <h3 className="persona-name">{persona.name}</h3>
              <span className="persona-role">{getRoleInfo(persona.role).name}</span>
            </div>
            <p className="persona-description">{persona.description}</p>
            
            <div className="persona-dimensions-preview">
              {Object.entries(persona.dimensions).map(([dimId, dimData]) => {
                if (!dimData) return null
                return (
                  <div key={dimId} className="dimension-preview-item">
                    <span className="dim-icon">{getDimensionIcon(dimId)}</span>
                    <span className="dim-label">{getDimensionName(dimId)}</span>
                    <span className="dim-evidence-count">
                      {dimData.evidence?.length || 0}
                    </span>
                  </div>
                )
              })}
            </div>
            
            <div className="persona-footer">
              <span className="meta-item">创建于 {formatDate(persona.createdAt)}</span>
              <span className="meta-item">更新于 {formatDate(persona.updatedAt)}</span>
            </div>
            {currentPersona?.id === persona.id && (
              <div className="persona-active-indicator">
                <Check size={14} />
                <span>已选中</span>
              </div>
            )}
          </div>
        ))}

        {personas.length === 0 && (
          <div className="empty-state">
            <User size={48} className="empty-icon" />
            <h3>暂无数字人格</h3>
            <p>点击上方按钮创建您的第一个数字人格，或使用智能蒸馏功能从聊天记录中提取</p>
          </div>
        )}
      </div>

      {currentPersona && (
        <div className="persona-detail-panel">
          <div className="panel-header">
            <div className="detail-title">
              <span className="detail-emoji">{getRoleInfo(currentPersona.role).emoji}</span>
              <div>
                <h2>{currentPersona.name}</h2>
                <span className="detail-role">{getRoleInfo(currentPersona.role).name}</span>
              </div>
            </div>
            <button onClick={() => selectPersona('')} className="close-btn">
              <X size={20} />
            </button>
          </div>

          <div className="panel-content">
            <div className="detail-section">
              <h3 className="section-title">描述</h3>
              <p className="section-content">{currentPersona.description}</p>
            </div>

            <div className="detail-section">
              <h3 className="section-title">数据来源</h3>
              {currentPersona.sources.length > 0 ? (
                <div className="sources-list">
                  {currentPersona.sources.map(source => (
                    <div key={source.id} className="source-item">
                      <span className="source-platform">{source.platform}</span>
                      <div className="source-details">
                        <span className="source-name">{source.name}</span>
                        <span className="source-meta">
                          {source.itemsCount} 条 · {formatDate(source.collectedAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-hint">暂无数据来源</p>
              )}
            </div>

            <div className="dimensions-grid">
              {Object.entries(currentPersona.dimensions).map(([dimId, dimData]) => {
                if (!dimData) return null
                return (
                  <div key={dimId} className="dimension-card">
                    <div className="dimension-header">
                      <div className="dimension-icon-wrapper">
                        <span className="dimension-icon">{getDimensionIcon(dimId)}</span>
                      </div>
                      <div className="dimension-info">
                        <h4>{getDimensionName(dimId)}</h4>
                        <span className="dimension-update">
                          更新于 {formatDate(dimData.lastUpdated)}
                        </span>
                      </div>
                      {dimData.evidence && dimData.evidence.length > 0 && (
                        <button 
                          className="view-evidence-btn"
                          onClick={() => setShowEvidenceDetail(showEvidenceDetail === dimId ? null : dimId)}
                        >
                          {dimData.evidence.length} 条证据
                        </button>
                      )}
                    </div>
                    <div className="dimension-content">
                      <p>{dimData.content}</p>
                    </div>
                    
                    {showEvidenceDetail === dimId && dimData.evidence && (
                      <div className="evidence-list">
                        {dimData.evidence.map(evidence => (
                          <div key={evidence.id} className="evidence-item">
                            <span className={`evidence-level level-${evidence.level}`}>
                              {evidenceLevelInfo[evidence.level].name}
                            </span>
                            <p className="evidence-content">{evidence.content}</p>
                            {evidence.source && (
                              <span className="evidence-source">来源: {evidence.source}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {currentPersona.conflicts.length > 0 && (
              <div className="detail-section conflicts-section">
                <div className="section-header">
                  <h3 className="section-title">
                    <ShieldAlert size={18} />
                    冲突检测
                  </h3>
                </div>
                <div className="conflicts-list">
                  {currentPersona.conflicts.map(conflict => (
                    <div key={conflict.id} className="conflict-item">
                      <div className="conflict-header">
                        <h4>{conflict.description}</h4>
                        <span className={`conflict-status ${conflict.resolved ? 'resolved' : 'unresolved'}`}>
                          {conflict.resolved ? '已解决' : '未解决'}
                        </span>
                      </div>
                      <div className="conflicting-items">
                        {conflict.items.map((item, idx) => (
                          <div key={idx} className="conflicting-item">
                            <p>{item.content}</p>
                            {item.source && <span className="item-source">来源: {item.source}</span>}
                          </div>
                        ))}
                      </div>
                      {conflict.resolved && conflict.resolution && (
                        <div className="conflict-resolution">
                          <strong>解决方案: </strong>
                          <span>{conflict.resolution}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentPersona.snapshots.length > 0 && (
              <div className="detail-section">
                <h3 className="section-title">
                  <Clock size={18} />
                  版本历史
                </h3>
                <div className="snapshots-list">
                  {currentPersona.snapshots.map(snapshot => (
                    <div key={snapshot.id} className="snapshot-item">
                      <div className="snapshot-info">
                        <span className="snapshot-version">{snapshot.version}</span>
                        <span className="snapshot-note">{snapshot.note}</span>
                        <span className="snapshot-date">{formatDate(snapshot.timestamp)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>创建新人格</h2>
              <button onClick={() => setShowCreateModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>人格名称</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="输入人格名称"
                />
              </div>
              <div className="form-group">
                <label>角色类型</label>
                <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as PersonaRole })}>
                  {personaRoles.map((role) => (
                    <option key={role.id} value={role.id}>{role.emoji} {role.name} - {role.description}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="简单描述这个人格"
                />
              </div>
              <div className="form-group">
                <label>
                  <span className="field-icon">{getDimensionIcon('procedural')}</span>
                  程序性（工作方式与流程）
                </label>
                <textarea
                  value={formData.procedural}
                  onChange={(e) => setFormData({ ...formData, procedural: e.target.value })}
                  placeholder="描述工作方式、流程偏好等"
                />
              </div>
              <div className="form-group">
                <label>
                  <span className="field-icon">{getDimensionIcon('interaction')}</span>
                  互动性（沟通风格）
                </label>
                <textarea
                  value={formData.interaction}
                  onChange={(e) => setFormData({ ...formData, interaction: e.target.value })}
                  placeholder="描述沟通风格、表达方式等"
                />
              </div>
              <div className="form-group">
                <label>
                  <span className="field-icon">{getDimensionIcon('memory')}</span>
                  记忆（重要经历）
                </label>
                <textarea
                  value={formData.memory}
                  onChange={(e) => setFormData({ ...formData, memory: e.target.value })}
                  placeholder="描述重要的人生经历、关键事件等"
                />
              </div>
              <div className="form-group">
                <label>
                  <span className="field-icon">{getDimensionIcon('personality')}</span>
                  性格（个性特征）
                </label>
                <textarea
                  value={formData.personality}
                  onChange={(e) => setFormData({ ...formData, personality: e.target.value })}
                  placeholder="描述性格特点、价值观等"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={!formData.name}>创建</button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editingPersona && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>编辑人格</h2>
              <button onClick={() => setShowEditModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>人格名称</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>角色类型</label>
                <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as PersonaRole })}>
                  {personaRoles.map((role) => (
                    <option key={role.id} value={role.id}>{role.emoji} {role.name} - {role.description}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>
                  <span className="field-icon">{getDimensionIcon('procedural')}</span>
                  程序性
                </label>
                <textarea
                  value={formData.procedural}
                  onChange={(e) => setFormData({ ...formData, procedural: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>
                  <span className="field-icon">{getDimensionIcon('interaction')}</span>
                  互动性
                </label>
                <textarea
                  value={formData.interaction}
                  onChange={(e) => setFormData({ ...formData, interaction: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>
                  <span className="field-icon">{getDimensionIcon('memory')}</span>
                  记忆
                </label>
                <textarea
                  value={formData.memory}
                  onChange={(e) => setFormData({ ...formData, memory: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>
                  <span className="field-icon">{getDimensionIcon('personality')}</span>
                  性格
                </label>
                <textarea
                  value={formData.personality}
                  onChange={(e) => setFormData({ ...formData, personality: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleUpdate} disabled={!formData.name}>保存</button>
            </div>
          </div>
        </div>
      )}

      {showDistillerWizard && (
        <div className="wizard-overlay">
          <div className="wizard-container">
            <PersonaDistillerWizard onClose={() => setShowDistillerWizard(false)} />
          </div>
        </div>
      )}
    </div>
  )
}

export default PersonaManagerPage
