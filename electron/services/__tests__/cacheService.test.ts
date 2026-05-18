import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { existsSync, readFileSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

interface SessionMessageCacheEntry {
  updatedAt: number
  messages: any[]
}

class MessageCacheService {
  private readonly cacheFilePath: string
  private cache: Record<string, SessionMessageCacheEntry> = {}
  private readonly sessionLimit = 150
  private readonly maxSessionEntries = 48

  constructor(cacheBasePath: string) {
    this.cacheFilePath = join(cacheBasePath, 'session-messages.json')
    this.ensureCacheDir()
    this.loadCache()
  }

  private ensureCacheDir() {
    const dir = join(this.cacheFilePath, '..')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }

  private loadCache() {
    if (!existsSync(this.cacheFilePath)) return
    try {
      const raw = readFileSync(this.cacheFilePath, 'utf8')
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        this.cache = parsed
        this.pruneSessionEntries()
      }
    } catch (error) {
      this.cache = {}
    }
  }

  private pruneSessionEntries(): void {
    const entries = Object.entries(this.cache || {})
    if (entries.length <= this.maxSessionEntries) return

    entries.sort((left, right) => {
      const leftAt = Number(left[1]?.updatedAt || 0)
      const rightAt = Number(right[1]?.updatedAt || 0)
      return rightAt - leftAt
    })

    this.cache = Object.fromEntries(entries.slice(0, this.maxSessionEntries))
  }

  get(sessionId: string): SessionMessageCacheEntry | undefined {
    return this.cache[sessionId]
  }

  set(sessionId: string, messages: any[]): void {
    if (!sessionId) return
    const trimmed = messages.length > this.sessionLimit
      ? messages.slice(-this.sessionLimit)
      : messages.slice()
    this.cache[sessionId] = {
      updatedAt: Date.now(),
      messages: trimmed
    }
    this.pruneSessionEntries()
    this.persist()
  }

  private persist() {
    try {
      writeFileSync(this.cacheFilePath, JSON.stringify(this.cache), 'utf8')
    } catch (error) {}
  }

  clear(): void {
    this.cache = {}
    try {
      rmSync(this.cacheFilePath, { force: true })
    } catch (error) {}
  }
}

interface SessionStatsCacheStats {
  totalMessages: number
  voiceMessages: number
  imageMessages: number
  videoMessages: number
  emojiMessages: number
  transferMessages: number
  redPacketMessages: number
  callMessages: number
  firstTimestamp?: number
  lastTimestamp?: number
}

interface SessionStatsCacheEntry {
  updatedAt: number
  includeRelations: boolean
  stats: SessionStatsCacheStats
}

interface SessionStatsScopeMap {
  [sessionId: string]: SessionStatsCacheEntry
}

interface SessionStatsCacheStore {
  version: number
  scopes: Record<string, SessionStatsScopeMap>
}

const CACHE_VERSION = 2
const MAX_SESSION_ENTRIES_PER_SCOPE = 2000
const MAX_SCOPE_ENTRIES = 12

function toNonNegativeInt(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return Math.max(0, Math.floor(value))
}

function normalizeStats(raw: unknown): SessionStatsCacheStats | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>

  const totalMessages = toNonNegativeInt(source.totalMessages)
  const voiceMessages = toNonNegativeInt(source.voiceMessages)
  const imageMessages = toNonNegativeInt(source.imageMessages)
  const videoMessages = toNonNegativeInt(source.videoMessages)
  const emojiMessages = toNonNegativeInt(source.emojiMessages)
  const transferMessages = toNonNegativeInt(source.transferMessages)
  const redPacketMessages = toNonNegativeInt(source.redPacketMessages)
  const callMessages = toNonNegativeInt(source.callMessages)

  if (
    totalMessages === undefined ||
    voiceMessages === undefined ||
    imageMessages === undefined ||
    videoMessages === undefined ||
    emojiMessages === undefined ||
    transferMessages === undefined ||
    redPacketMessages === undefined ||
    callMessages === undefined
  ) {
    return null
  }

  const normalized: SessionStatsCacheStats = {
    totalMessages,
    voiceMessages,
    imageMessages,
    videoMessages,
    emojiMessages,
    transferMessages,
    redPacketMessages,
    callMessages
  }

  const firstTimestamp = toNonNegativeInt(source.firstTimestamp)
  if (firstTimestamp !== undefined) normalized.firstTimestamp = firstTimestamp

  const lastTimestamp = toNonNegativeInt(source.lastTimestamp)
  if (lastTimestamp !== undefined) normalized.lastTimestamp = lastTimestamp

  return normalized
}

function normalizeEntry(raw: unknown): SessionStatsCacheEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  const updatedAt = toNonNegativeInt(source.updatedAt)
  const includeRelations = typeof source.includeRelations === 'boolean' ? source.includeRelations : false
  const stats = normalizeStats(source.stats)

  if (updatedAt === undefined || !stats) {
    return null
  }

  return {
    updatedAt,
    includeRelations,
    stats
  }
}

class SessionStatsCacheService {
  private readonly cacheFilePath: string
  private store: SessionStatsCacheStore = {
    version: CACHE_VERSION,
    scopes: {}
  }

  constructor(cacheBasePath: string) {
    this.cacheFilePath = join(cacheBasePath, 'session-stats.json')
    this.ensureCacheDir()
    this.load()
  }

  private ensureCacheDir(): void {
    const dir = join(this.cacheFilePath, '..')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }

  private load(): void {
    if (!existsSync(this.cacheFilePath)) return
    try {
      const raw = readFileSync(this.cacheFilePath, 'utf8')
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object') {
        this.store = { version: CACHE_VERSION, scopes: {} }
        return
      }

      const payload = parsed as Record<string, unknown>
      const version = Number(payload.version)
      if (!Number.isFinite(version) || version !== CACHE_VERSION) {
        this.store = { version: CACHE_VERSION, scopes: {} }
        return
      }
      const scopesRaw = payload.scopes
      if (!scopesRaw || typeof scopesRaw !== 'object') {
        this.store = { version: CACHE_VERSION, scopes: {} }
        return
      }

      const scopes: Record<string, SessionStatsScopeMap> = {}
      for (const [scopeKey, scopeValue] of Object.entries(scopesRaw as Record<string, unknown>)) {
        if (!scopeValue || typeof scopeValue !== 'object') continue
        const normalizedScope: SessionStatsScopeMap = {}
        for (const [sessionId, entryRaw] of Object.entries(scopeValue as Record<string, unknown>)) {
          const entry = normalizeEntry(entryRaw)
          if (!entry) continue
          normalizedScope[sessionId] = entry
        }
        if (Object.keys(normalizedScope).length > 0) {
          scopes[scopeKey] = normalizedScope
        }
      }

      this.store = {
        version: CACHE_VERSION,
        scopes
      }
    } catch (error) {
      this.store = { version: CACHE_VERSION, scopes: {} }
    }
  }

  get(scopeKey: string, sessionId: string): SessionStatsCacheEntry | undefined {
    if (!scopeKey || !sessionId) return undefined
    const scope = this.store.scopes[scopeKey]
    if (!scope) return undefined
    const entry = normalizeEntry(scope[sessionId])
    if (!entry) {
      delete scope[sessionId]
      if (Object.keys(scope).length === 0) {
        delete this.store.scopes[scopeKey]
      }
      this.persist()
      return undefined
    }
    return entry
  }

  set(scopeKey: string, sessionId: string, entry: SessionStatsCacheEntry): void {
    if (!scopeKey || !sessionId) return
    const normalized = normalizeEntry(entry)
    if (!normalized) return

    if (!this.store.scopes[scopeKey]) {
      this.store.scopes[scopeKey] = {}
    }
    this.store.scopes[scopeKey][sessionId] = normalized

    this.trimScope(scopeKey)
    this.trimScopes()
    this.persist()
  }

  delete(scopeKey: string, sessionId: string): void {
    if (!scopeKey || !sessionId) return
    const scope = this.store.scopes[scopeKey]
    if (!scope) return
    if (!(sessionId in scope)) return

    delete scope[sessionId]
    if (Object.keys(scope).length === 0) {
      delete this.store.scopes[scopeKey]
    }
    this.persist()
  }

  clearScope(scopeKey: string): void {
    if (!scopeKey) return
    if (!this.store.scopes[scopeKey]) return
    delete this.store.scopes[scopeKey]
    this.persist()
  }

  clearAll(): void {
    this.store = { version: CACHE_VERSION, scopes: {} }
    try {
      rmSync(this.cacheFilePath, { force: true })
    } catch (error) {}
  }

  private trimScope(scopeKey: string): void {
    const scope = this.store.scopes[scopeKey]
    if (!scope) return
    const entries = Object.entries(scope)
    if (entries.length <= MAX_SESSION_ENTRIES_PER_SCOPE) return

    entries.sort((a, b) => b[1].updatedAt - a[1].updatedAt)
    const trimmed: SessionStatsScopeMap = {}
    for (const [sessionId, entry] of entries.slice(0, MAX_SESSION_ENTRIES_PER_SCOPE)) {
      trimmed[sessionId] = entry
    }
    this.store.scopes[scopeKey] = trimmed
  }

  private trimScopes(): void {
    const scopeEntries = Object.entries(this.store.scopes)
    if (scopeEntries.length <= MAX_SCOPE_ENTRIES) return

    scopeEntries.sort((a, b) => {
      const aUpdatedAt = Math.max(...Object.values(a[1]).map((entry) => entry.updatedAt), 0)
      const bUpdatedAt = Math.max(...Object.values(b[1]).map((entry) => entry.updatedAt), 0)
      return bUpdatedAt - aUpdatedAt
    })

    const trimmedScopes: Record<string, SessionStatsScopeMap> = {}
    for (const [scopeKey, scopeMap] of scopeEntries.slice(0, MAX_SCOPE_ENTRIES)) {
      trimmedScopes[scopeKey] = scopeMap
    }
    this.store.scopes = trimmedScopes
  }

  private persist(): void {
    try {
      writeFileSync(this.cacheFilePath, JSON.stringify(this.store), 'utf8')
    } catch (error) {}
  }
}

export interface ExportContentSessionStatsEntry {
  updatedAt: number
  hasAny: boolean
  hasVoice: boolean
  hasImage: boolean
  hasVideo: boolean
  hasEmoji: boolean
  mediaReady: boolean
}

export interface ExportContentScopeStatsEntry {
  updatedAt: number
  sessions: Record<string, ExportContentSessionStatsEntry>
}

interface ExportContentStatsStore {
  version: number
  scopes: Record<string, ExportContentScopeStatsEntry>
}

const EXPORT_CACHE_VERSION = 1
const EXPORT_MAX_SCOPE_ENTRIES = 12
const EXPORT_MAX_SESSION_ENTRIES_PER_SCOPE = 6000

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  return fallback
}

function normalizeExportSessionStatsEntry(raw: unknown): ExportContentSessionStatsEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  const updatedAt = toNonNegativeInt(source.updatedAt)
  if (updatedAt === undefined) return null
  return {
    updatedAt,
    hasAny: toBoolean(source.hasAny, false),
    hasVoice: toBoolean(source.hasVoice, false),
    hasImage: toBoolean(source.hasImage, false),
    hasVideo: toBoolean(source.hasVideo, false),
    hasEmoji: toBoolean(source.hasEmoji, false),
    mediaReady: toBoolean(source.mediaReady, false)
  }
}

function normalizeExportScopeStatsEntry(raw: unknown): ExportContentScopeStatsEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  const updatedAt = toNonNegativeInt(source.updatedAt)
  if (updatedAt === undefined) return null

  const sessionsRaw = source.sessions
  if (!sessionsRaw || typeof sessionsRaw !== 'object') {
    return {
      updatedAt,
      sessions: {}
    }
  }

  const sessions: Record<string, ExportContentSessionStatsEntry> = {}
  for (const [sessionId, entryRaw] of Object.entries(sessionsRaw as Record<string, unknown>)) {
    const normalized = normalizeExportSessionStatsEntry(entryRaw)
    if (!normalized) continue
    sessions[sessionId] = normalized
  }

  return {
    updatedAt,
    sessions
  }
}

function cloneExportScope(scope: ExportContentScopeStatsEntry): ExportContentScopeStatsEntry {
  return {
    updatedAt: scope.updatedAt,
    sessions: Object.fromEntries(
      Object.entries(scope.sessions).map(([sessionId, entry]) => [sessionId, { ...entry }])
    )
  }
}

class ExportContentStatsCacheService {
  private readonly cacheFilePath: string
  private store: ExportContentStatsStore = {
    version: EXPORT_CACHE_VERSION,
    scopes: {}
  }

  constructor(cacheBasePath: string) {
    this.cacheFilePath = join(cacheBasePath, 'export-content-stats.json')
    this.ensureCacheDir()
    this.load()
  }

  private ensureCacheDir(): void {
    const dir = join(this.cacheFilePath, '..')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }

  private load(): void {
    if (!existsSync(this.cacheFilePath)) return
    try {
      const raw = readFileSync(this.cacheFilePath, 'utf8')
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object') {
        this.store = { version: EXPORT_CACHE_VERSION, scopes: {} }
        return
      }

      const payload = parsed as Record<string, unknown>
      const scopesRaw = payload.scopes
      if (!scopesRaw || typeof scopesRaw !== 'object') {
        this.store = { version: EXPORT_CACHE_VERSION, scopes: {} }
        return
      }

      const scopes: Record<string, ExportContentScopeStatsEntry> = {}
      for (const [scopeKey, scopeRaw] of Object.entries(scopesRaw as Record<string, unknown>)) {
        const normalizedScope = normalizeExportScopeStatsEntry(scopeRaw)
        if (!normalizedScope) continue
        scopes[scopeKey] = normalizedScope
      }

      this.store = {
        version: EXPORT_CACHE_VERSION,
        scopes
      }
    } catch (error) {
      this.store = { version: EXPORT_CACHE_VERSION, scopes: {} }
    }
  }

  getScope(scopeKey: string): ExportContentScopeStatsEntry | undefined {
    if (!scopeKey) return undefined
    const rawScope = this.store.scopes[scopeKey]
    if (!rawScope) return undefined
    const normalizedScope = normalizeExportScopeStatsEntry(rawScope)
    if (!normalizedScope) {
      delete this.store.scopes[scopeKey]
      this.persist()
      return undefined
    }
    this.store.scopes[scopeKey] = normalizedScope
    return cloneExportScope(normalizedScope)
  }

  setScope(scopeKey: string, scope: ExportContentScopeStatsEntry): void {
    if (!scopeKey) return
    const normalized = normalizeExportScopeStatsEntry(scope)
    if (!normalized) return
    this.store.scopes[scopeKey] = normalized
    this.trimScope(scopeKey)
    this.trimScopes()
    this.persist()
  }

  deleteSession(scopeKey: string, sessionId: string): void {
    if (!scopeKey || !sessionId) return
    const scope = this.store.scopes[scopeKey]
    if (!scope) return
    if (!(sessionId in scope.sessions)) return
    delete scope.sessions[sessionId]
    if (Object.keys(scope.sessions).length === 0) {
      delete this.store.scopes[scopeKey]
    } else {
      scope.updatedAt = Date.now()
    }
    this.persist()
  }

  clearScope(scopeKey: string): void {
    if (!scopeKey) return
    if (!this.store.scopes[scopeKey]) return
    delete this.store.scopes[scopeKey]
    this.persist()
  }

  clearAll(): void {
    this.store = { version: EXPORT_CACHE_VERSION, scopes: {} }
    try {
      rmSync(this.cacheFilePath, { force: true })
    } catch (error) {}
  }

  private trimScope(scopeKey: string): void {
    const scope = this.store.scopes[scopeKey]
    if (!scope) return

    const entries = Object.entries(scope.sessions)
    if (entries.length <= EXPORT_MAX_SESSION_ENTRIES_PER_SCOPE) return

    entries.sort((a, b) => b[1].updatedAt - a[1].updatedAt)
    scope.sessions = Object.fromEntries(entries.slice(0, EXPORT_MAX_SESSION_ENTRIES_PER_SCOPE))
  }

  private trimScopes(): void {
    const scopeEntries = Object.entries(this.store.scopes)
    if (scopeEntries.length <= EXPORT_MAX_SCOPE_ENTRIES) return

    scopeEntries.sort((a, b) => b[1].updatedAt - a[1].updatedAt)
    this.store.scopes = Object.fromEntries(scopeEntries.slice(0, EXPORT_MAX_SCOPE_ENTRIES))
  }

  private persist(): void {
    try {
      this.ensureCacheDir()
      writeFileSync(this.cacheFilePath, JSON.stringify(this.store), 'utf8')
    } catch (error) {}
  }
}

class LRUCache<K, V> {
  private cache: Map<K, V>
  private maxSize: number

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize
    this.cache = new Map()
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key)
    if (value !== undefined) {
      this.cache.delete(key)
      this.cache.set(key, value)
    }
    return value
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }
    this.cache.set(key, value)
  }

  has(key: K): boolean {
    return this.cache.has(key)
  }

  delete(key: K): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }

  keys(): IterableIterator<K> {
    return this.cache.keys()
  }

  values(): IterableIterator<V> {
    return this.cache.values()
  }

  entries(): IterableIterator<[K, V]> {
    return this.cache.entries()
  }

  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.cache.entries()
  }

  cleanup(): void {
    if (this.cache.size > this.maxSize * 1.5) {
      const entries = Array.from(this.cache.entries())
      this.cache.clear()
      const keepEntries = entries.slice(-Math.floor(this.maxSize / 2))
      keepEntries.forEach(([key, value]) => this.cache.set(key, value))
    }
  }
}

describe('WePersona 缓存系统测试', () => {
  const testCacheDir = join(tmpdir(), 'wepersona-cache-test-' + Date.now())
  let messageCache: MessageCacheService
  let sessionStatsCache: SessionStatsCacheService
  let exportStatsCache: ExportContentStatsCacheService

  beforeAll(() => {
    mkdirSync(testCacheDir, { recursive: true })
  })

  afterEach(() => {
    messageCache?.clear()
    sessionStatsCache?.clearAll()
    exportStatsCache?.clearAll()
  })

  afterAll(() => {
    rmSync(testCacheDir, { force: true, recursive: true })
  })

  describe('MessageCacheService - 消息缓存服务', () => {
    beforeEach(() => {
      messageCache = new MessageCacheService(testCacheDir)
    })

    test('基本存取功能', () => {
      const sessionId = 'test-session-1'
      const messages = [{ id: 1, content: 'Hello' }, { id: 2, content: 'World' }]

      messageCache.set(sessionId, messages)
      const cached = messageCache.get(sessionId)

      expect(cached).toBeDefined()
      expect(cached?.messages).toHaveLength(2)
      expect(cached?.messages[0].content).toBe('Hello')
      expect(cached?.updatedAt).toBeGreaterThan(0)
    })

    test('消息数量限制 - 超过150条时保留最新150条', () => {
      const sessionId = 'test-session-limit'
      const messages = Array.from({ length: 200 }, (_, i) => ({
        id: i + 1,
        content: `Message ${i + 1}`
      }))

      messageCache.set(sessionId, messages)
      const cached = messageCache.get(sessionId)

      expect(cached?.messages).toHaveLength(150)
      expect(cached?.messages[0].content).toBe('Message 51')
      expect(cached?.messages[149].content).toBe('Message 200')
    })

    test('会话数量限制 - 超过48个会话时删除最旧的', () => {
      for (let i = 0; i < 60; i++) {
        messageCache.set(`session-${i}`, [{ id: i, content: `Msg ${i}` }])
      }

      const cacheKeys = Object.keys((messageCache as any).cache)
      expect(cacheKeys.length).toBeLessThanOrEqual(48)

      expect(messageCache.get('session-0')).toBeUndefined()
      expect(messageCache.get('session-59')).toBeDefined()
    })

    test('会话更新时更新时间戳', async () => {
      const sessionId = 'test-session-update'
      messageCache.set(sessionId, [{ id: 1, content: 'First' }])
      const first = messageCache.get(sessionId)
      const firstTime = first?.updatedAt

      await new Promise(resolve => setTimeout(resolve, 10))

      messageCache.set(sessionId, [{ id: 2, content: 'Second' }])
      const second = messageCache.get(sessionId)

      expect(second?.updatedAt).toBeGreaterThan(firstTime!)
      expect(second?.messages).toHaveLength(1)
      expect(second?.messages[0].content).toBe('Second')
    })

    test('持久化验证 - 重新实例化后数据保留', () => {
      const sessionId = 'test-persist'
      const messages = [{ id: 1, content: 'Persisted' }]

      messageCache.set(sessionId, messages)
      const cacheFilePath = join(testCacheDir, 'session-messages.json')

      expect(existsSync(cacheFilePath)).toBe(true)

      const rawContent = readFileSync(cacheFilePath, 'utf8')
      const parsed = JSON.parse(rawContent)
      expect(parsed[sessionId]).toBeDefined()
      expect(parsed[sessionId].messages[0].content).toBe('Persisted')

      const newCache = new MessageCacheService(testCacheDir)
      const restored = newCache.get(sessionId)
      expect(restored?.messages[0].content).toBe('Persisted')
    })

    test('清空缓存功能', () => {
      messageCache.set('session-1', [{ id: 1, content: 'Test' }])
      expect(messageCache.get('session-1')).toBeDefined()

      messageCache.clear()

      expect(messageCache.get('session-1')).toBeUndefined()
      const cacheFilePath = join(testCacheDir, 'session-messages.json')
      expect(existsSync(cacheFilePath)).toBe(false)
    })

    test('空sessionId处理', () => {
      const messages = [{ id: 1, content: 'Test' }]
      messageCache.set('', messages)
      expect(messageCache.get('')).toBeUndefined()
    })

    test('损坏的缓存文件处理', () => {
      const cacheFilePath = join(testCacheDir, 'session-messages.json')

      writeFileSync(cacheFilePath, 'invalid json {{{', 'utf8')

      const newCache = new MessageCacheService(testCacheDir)
      expect(Object.keys((newCache as any).cache).length).toBe(0)
    })

    test('边界 - 空消息数组', () => {
      messageCache.set('empty-session', [])
      const cached = messageCache.get('empty-session')
      expect(cached).toBeDefined()
      expect(cached?.messages).toHaveLength(0)
    })

    test('边界 - 刚好150条消息', () => {
      const sessionId = 'exact-limit'
      const messages = Array.from({ length: 150 }, (_, i) => ({
        id: i + 1,
        content: `Msg ${i + 1}`
      }))

      messageCache.set(sessionId, messages)
      expect(messageCache.get(sessionId)?.messages).toHaveLength(150)
    })

    test('边界 - 刚好49个会话', () => {
      for (let i = 0; i < 49; i++) {
        messageCache.set(`session-${i}`, [{ id: i, content: `Msg ${i}` }])
      }

      expect(Object.keys((messageCache as any).cache).length).toBe(49)
    })

    test('并发更新同一会话', () => {
      const sessionId = 'concurrent-test'

      messageCache.set(sessionId, [{ id: 1, content: 'First' }])
      messageCache.set(sessionId, [{ id: 2, content: 'Second' }])
      messageCache.set(sessionId, [{ id: 3, content: 'Third' }])

      const cached = messageCache.get(sessionId)
      expect(cached?.messages).toHaveLength(1)
      expect(cached?.messages[0].content).toBe('Third')
    })
  })

  describe('SessionStatsCacheService - 会话统计缓存', () => {
    beforeEach(() => {
      sessionStatsCache = new SessionStatsCacheService(testCacheDir)
    })

    test('基本存取功能', () => {
      const scopeKey = 'analytics'
      const sessionId = 'session-1'
      const entry = {
        updatedAt: Date.now(),
        includeRelations: true,
        stats: {
          totalMessages: 1000,
          voiceMessages: 50,
          imageMessages: 200,
          videoMessages: 10,
          emojiMessages: 500,
          transferMessages: 5,
          redPacketMessages: 3,
          callMessages: 2
        }
      }

      sessionStatsCache.set(scopeKey, sessionId, entry)
      const cached = sessionStatsCache.get(scopeKey, sessionId)

      expect(cached).toBeDefined()
      expect(cached?.stats.totalMessages).toBe(1000)
      expect(cached?.includeRelations).toBe(true)
    })

    test('版本控制 - 错误版本重置', () => {
      const cacheFilePath = join(testCacheDir, 'session-stats.json')
      const badContent = JSON.stringify({
        version: 999,
        scopes: {}
      })
      writeFileSync(cacheFilePath, badContent, 'utf8')

      const newCache = new SessionStatsCacheService(testCacheDir)
      expect(Object.keys((newCache as any).store.scopes).length).toBe(0)
    })

    test('会话级别限制 - 每个scope最多2000条', () => {
      const scopeKey = 'large-scope'
      const baseTime = Date.now()

      for (let i = 0; i < 2500; i++) {
        sessionStatsCache.set(scopeKey, `session-${i}`, {
          updatedAt: baseTime + i,
          includeRelations: false,
          stats: {
            totalMessages: i,
            voiceMessages: 0,
            imageMessages: 0,
            videoMessages: 0,
            emojiMessages: 0,
            transferMessages: 0,
            redPacketMessages: 0,
            callMessages: 0
          }
        })
      }

      const scope = (sessionStatsCache as any).store.scopes[scopeKey]
      expect(Object.keys(scope).length).toBeLessThanOrEqual(2000)
    })

    test('Scope级别限制 - 最多12个scope', () => {
      const baseTime = Date.now()

      for (let i = 0; i < 20; i++) {
        const scopeKey = `scope-${i}`
        sessionStatsCache.set(scopeKey, `session-0`, {
          updatedAt: baseTime + i,
          includeRelations: false,
          stats: {
            totalMessages: i,
            voiceMessages: 0,
            imageMessages: 0,
            videoMessages: 0,
            emojiMessages: 0,
            transferMessages: 0,
            redPacketMessages: 0,
            callMessages: 0
          }
        })
      }

      const scopes = (sessionStatsCache as any).store.scopes
      expect(Object.keys(scopes).length).toBeLessThanOrEqual(12)
    })

    test('删除功能', () => {
      sessionStatsCache.set('scope-1', 'session-1', {
        updatedAt: Date.now(),
        includeRelations: false,
        stats: {
          totalMessages: 100,
          voiceMessages: 0,
          imageMessages: 0,
          videoMessages: 0,
          emojiMessages: 0,
          transferMessages: 0,
          redPacketMessages: 0,
          callMessages: 0
        }
      })

      expect(sessionStatsCache.get('scope-1', 'session-1')).toBeDefined()

      sessionStatsCache.delete('scope-1', 'session-1')
      expect(sessionStatsCache.get('scope-1', 'session-1')).toBeUndefined()
    })

    test('清空scope功能', () => {
      sessionStatsCache.set('scope-1', 'session-1', {
        updatedAt: Date.now(),
        includeRelations: false,
        stats: {
          totalMessages: 100,
          voiceMessages: 0,
          imageMessages: 0,
          videoMessages: 0,
          emojiMessages: 0,
          transferMessages: 0,
          redPacketMessages: 0,
          callMessages: 0
        }
      })
      sessionStatsCache.set('scope-1', 'session-2', {
        updatedAt: Date.now(),
        includeRelations: false,
        stats: {
          totalMessages: 200,
          voiceMessages: 0,
          imageMessages: 0,
          videoMessages: 0,
          emojiMessages: 0,
          transferMessages: 0,
          redPacketMessages: 0,
          callMessages: 0
        }
      })

      sessionStatsCache.clearScope('scope-1')
      expect(sessionStatsCache.get('scope-1', 'session-1')).toBeUndefined()
      expect(sessionStatsCache.get('scope-1', 'session-2')).toBeUndefined()
    })

    test('数据规范化 - 无效数据过滤', () => {
      const scopeKey = 'test'
      const cacheFilePath = join(testCacheDir, 'session-stats.json')

      const badData = {
        version: 2,
        scopes: {
          [scopeKey]: {
            'bad-entry': {
              updatedAt: 'invalid',
              includeRelations: 'not-boolean',
              stats: null
            },
            'good-entry': {
              updatedAt: 1234567890,
              includeRelations: true,
              stats: {
                totalMessages: 100,
                voiceMessages: 10,
                imageMessages: 20,
                videoMessages: 5,
                emojiMessages: 30,
                transferMessages: 2,
                redPacketMessages: 1,
                callMessages: 0
              }
            }
          }
        }
      }

      writeFileSync(cacheFilePath, JSON.stringify(badData), 'utf8')

      const newCache = new SessionStatsCacheService(testCacheDir)
      expect(newCache.get(scopeKey, 'bad-entry')).toBeUndefined()
      expect(newCache.get(scopeKey, 'good-entry')).toBeDefined()
    })
  })

  describe('ExportContentStatsCacheService - 导出内容统计缓存', () => {
    beforeEach(() => {
      exportStatsCache = new ExportContentStatsCacheService(testCacheDir)
    })

    test('基本存取功能', () => {
      const scopeKey = 'export-scope'
      const scope = {
        updatedAt: Date.now(),
        sessions: {
          'session-1': {
            updatedAt: Date.now(),
            hasAny: true,
            hasVoice: true,
            hasImage: false,
            hasVideo: false,
            hasEmoji: true,
            mediaReady: true
          }
        }
      }

      exportStatsCache.setScope(scopeKey, scope)
      const cached = exportStatsCache.getScope(scopeKey)

      expect(cached).toBeDefined()
      expect(cached?.sessions['session-1'].hasVoice).toBe(true)
      expect(cached?.sessions['session-1'].hasImage).toBe(false)
    })

    test('每个scope最多6000个会话', () => {
      const scopeKey = 'large-export'
      const baseTime = Date.now()

      for (let i = 0; i < 7000; i++) {
        const scope = {
          updatedAt: baseTime + i,
          sessions: {
            [`session-${i}`]: {
              updatedAt: baseTime + i,
              hasAny: true,
              hasVoice: false,
              hasImage: false,
              hasVideo: false,
              hasEmoji: false,
              mediaReady: false
            }
          }
        }
        exportStatsCache.setScope(scopeKey, scope)
      }

      const cached = exportStatsCache.getScope(scopeKey)
      expect(Object.keys(cached?.sessions || {}).length).toBeLessThanOrEqual(6000)
    })

    test('删除会话功能', () => {
      const scopeKey = 'delete-test'
      const scope = {
        updatedAt: Date.now(),
        sessions: {
          'session-1': {
            updatedAt: Date.now(),
            hasAny: true,
            hasVoice: false,
            hasImage: false,
            hasVideo: false,
            hasEmoji: false,
            mediaReady: false
          },
          'session-2': {
            updatedAt: Date.now(),
            hasAny: true,
            hasVoice: false,
            hasImage: false,
            hasVideo: false,
            hasEmoji: false,
            mediaReady: false
          }
        }
      }

      exportStatsCache.setScope(scopeKey, scope)
      exportStatsCache.deleteSession(scopeKey, 'session-1')

      const cached = exportStatsCache.getScope(scopeKey)
      expect(cached?.sessions['session-1']).toBeUndefined()
      expect(cached?.sessions['session-2']).toBeDefined()
    })

    test('持久化验证', () => {
      const scopeKey = 'persist-test'
      exportStatsCache.setScope(scopeKey, {
        updatedAt: Date.now(),
        sessions: {
          'session-1': {
            updatedAt: Date.now(),
            hasAny: true,
            hasVoice: true,
            hasImage: false,
            hasVideo: false,
            hasEmoji: false,
            mediaReady: true
          }
        }
      })

      const newCache = new ExportContentStatsCacheService(testCacheDir)
      const cached = newCache.getScope(scopeKey)
      expect(cached?.sessions['session-1']).toBeDefined()
    })
  })

  describe('LRUCache - LRU缓存实现', () => {
    test('基本功能', () => {
      const cache = new LRUCache<string, number>(3)

      cache.set('a', 1)
      cache.set('b', 2)
      cache.set('c', 3)

      expect(cache.get('a')).toBe(1)
      expect(cache.get('b')).toBe(2)
      expect(cache.get('c')).toBe(3)
      expect(cache.size).toBe(3)
    })

    test('LRU淘汰 - 超出容量时删除最旧的', () => {
      const cache = new LRUCache<string, number>(3)

      cache.set('a', 1)
      cache.set('b', 2)
      cache.set('c', 3)
      cache.set('d', 4)

      expect(cache.has('a')).toBe(false)
      expect(cache.has('b')).toBe(true)
      expect(cache.has('c')).toBe(true)
      expect(cache.has('d')).toBe(true)
    })

    test('访问后更新LRU顺序', () => {
      const cache = new LRUCache<string, number>(3)

      cache.set('a', 1)
      cache.set('b', 2)
      cache.set('c', 3)

      cache.get('a')

      cache.set('d', 4)

      expect(cache.has('a')).toBe(true)
      expect(cache.has('b')).toBe(false)
    })

    test('更新现有key不影响LRU顺序', () => {
      const cache = new LRUCache<string, number>(3)

      cache.set('a', 1)
      cache.set('b', 2)
      cache.set('c', 3)

      cache.set('a', 10)

      cache.set('d', 4)

      expect(cache.has('a')).toBe(true)
      expect(cache.has('b')).toBe(false)
    })

    test('清空功能', () => {
      const cache = new LRUCache<string, number>(3)

      cache.set('a', 1)
      cache.set('b', 2)

      cache.clear()

      expect(cache.size).toBe(0)
      expect(cache.get('a')).toBeUndefined()
    })

    test('删除功能', () => {
      const cache = new LRUCache<string, number>(3)

      cache.set('a', 1)
      cache.set('b', 2)

      expect(cache.delete('a')).toBe(true)
      expect(cache.delete('a')).toBe(false)

      expect(cache.size).toBe(1)
    })

    test('容量为0的处理', () => {
      const cache = new LRUCache<string, number>(0)

      cache.set('a', 1)
      expect(cache.size).toBe(0)
      expect(cache.get('a')).toBeUndefined()
    })

    test('迭代器功能', () => {
      const cache = new LRUCache<string, number>(3)
      cache.set('a', 1)
      cache.set('b', 2)

      const entries = Array.from(cache.entries())
      expect(entries).toHaveLength(2)

      const keys = Array.from(cache.keys())
      expect(keys).toContain('a')
      expect(keys).toContain('b')
    })

    test('紧急清理 - 超过1.5倍容量时强制清理', () => {
      const cache = new LRUCache<string, number>(10)

      for (let i = 0; i < 20; i++) {
        cache.set(`key-${i}`, i)
      }

      ;(cache as any).cleanup()

      expect(cache.size).toBeLessThanOrEqual(5)
    })
  })

  describe('缓存系统综合测试', () => {
    test('多个缓存服务共享缓存目录', () => {
      const messageCache = new MessageCacheService(testCacheDir)
      const sessionStatsCache = new SessionStatsCacheService(testCacheDir)

      messageCache.set('session-1', [{ id: 1, content: 'Test' }])
      sessionStatsCache.set('scope-1', 'session-1', {
        updatedAt: Date.now(),
        includeRelations: false,
        stats: {
          totalMessages: 100,
          voiceMessages: 10,
          imageMessages: 20,
          videoMessages: 5,
          emojiMessages: 30,
          transferMessages: 2,
          redPacketMessages: 1,
          callMessages: 0
        }
      })

      expect(messageCache.get('session-1')).toBeDefined()
      expect(sessionStatsCache.get('scope-1', 'session-1')).toBeDefined()
    })

    test('大量数据写入性能测试', () => {
      const messageCache = new MessageCacheService(testCacheDir)
      const startTime = Date.now()

      for (let i = 0; i < 100; i++) {
        const messages = Array.from({ length: 50 }, (_, j) => ({
          id: j,
          content: `Message ${j}`
        }))
        messageCache.set(`session-${i}`, messages)
      }

      const elapsed = Date.now() - startTime
      console.log(`写入100个会话缓存耗时: ${elapsed}ms`)
      expect(elapsed).toBeLessThan(5000)
    })

    test('缓存文件大小验证', () => {
      const messageCache = new MessageCacheService(testCacheDir)

      for (let i = 0; i < 48; i++) {
        const messages = Array.from({ length: 150 }, (_, j) => ({
          id: j,
          content: `Long content message ${j} with some extra text to increase size`
        }))
        messageCache.set(`session-${i}`, messages)
      }

      const cacheFilePath = join(testCacheDir, 'session-messages.json')
      const stats = require('fs').statSync(cacheFilePath)
      const sizeInMB = stats.size / (1024 * 1024)

      console.log(`缓存文件大小: ${sizeInMB.toFixed(2)} MB`)
      expect(sizeInMB).toBeLessThan(10)
    })
  })

  describe('错误处理和边界情况', () => {
    test('MessageCache - 处理undefined消息', () => {
      const messageCache = new MessageCacheService(testCacheDir)
      messageCache.set('session-1', undefined as any)
      expect(messageCache.get('session-1')?.messages).toHaveLength(0)
    })

    test('MessageCache - 处理null消息', () => {
      const messageCache = new MessageCacheService(testCacheDir)
      messageCache.set('session-1', null as any)
      expect(messageCache.get('session-1')?.messages).toHaveLength(0)
    })

    test('SessionStatsCache - 无效的stats数据', () => {
      const sessionStatsCache = new SessionStatsCacheService(testCacheDir)

      sessionStatsCache.set('scope', 'session', {
        updatedAt: Date.now(),
        includeRelations: false,
        stats: {
          totalMessages: -100,
          voiceMessages: 0,
          imageMessages: 0,
          videoMessages: 0,
          emojiMessages: 0,
          transferMessages: 0,
          redPacketMessages: 0,
          callMessages: 0
        } as any
      })

      expect(sessionStatsCache.get('scope', 'session')).toBeUndefined()
    })

    test('LRUCache - 特殊字符作为key', () => {
      const cache = new LRUCache<string, number>(3)

      cache.set('', 1)
      cache.set('with space', 2)
      cache.set('with/slash', 3)

      expect(cache.get('')).toBe(1)
      expect(cache.get('with space')).toBe(2)
      expect(cache.get('with/slash')).toBe(3)
    })
  })
})
