import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  ChatStatistics,
  ContactRanking,
  TimeDistribution,
  HeatmapData,
  WordcloudData,
  CalendarData,
  KeywordAnalysis
} from '../types/analytics'

interface AnalyticsState {
  // 基础数据
  statistics: ChatStatistics | null
  rankings: ContactRanking[]
  timeDistribution: TimeDistribution | null

  // 新增高级分析数据
  heatmapData: HeatmapData | null
  wordcloudData: WordcloudData | null
  calendarData: CalendarData[]
  keywordAnalysis: KeywordAnalysis | null

  // 状态
  isLoaded: boolean
  isAdvancedLoaded: boolean
  lastLoadTime: number | null

  // Actions
  setStatistics: (data: ChatStatistics) => void
  setRankings: (data: ContactRanking[]) => void
  setTimeDistribution: (data: TimeDistribution) => void
  setHeatmapData: (data: HeatmapData) => void
  setWordcloudData: (data: WordcloudData) => void
  setCalendarData: (data: CalendarData[]) => void
  setKeywordAnalysis: (data: KeywordAnalysis) => void
  markLoaded: () => void
  markAdvancedLoaded: () => void
  clearCache: () => void
}

export const useAnalyticsStore = create<AnalyticsState>()(
  persist(
    (set) => ({
      statistics: null,
      rankings: [],
      timeDistribution: null,
      heatmapData: null,
      wordcloudData: null,
      calendarData: [],
      keywordAnalysis: null,
      isLoaded: false,
      isAdvancedLoaded: false,
      lastLoadTime: null,

      setStatistics: (data) => set({ statistics: data }),
      setRankings: (data) => set({ rankings: data }),
      setTimeDistribution: (data) => set({ timeDistribution: data }),
      setHeatmapData: (data) => set({ heatmapData: data }),
      setWordcloudData: (data) => set({ wordcloudData: data }),
      setCalendarData: (data) => set({ calendarData: data }),
      setKeywordAnalysis: (data) => set({ keywordAnalysis: data }),
      markLoaded: () => set({ isLoaded: true, lastLoadTime: Date.now() }),
      markAdvancedLoaded: () => set({ isAdvancedLoaded: true }),
      clearCache: () => set({
        statistics: null,
        rankings: [],
        timeDistribution: null,
        heatmapData: null,
        wordcloudData: null,
        calendarData: [],
        keywordAnalysis: null,
        isLoaded: false,
        isAdvancedLoaded: false,
        lastLoadTime: null
      }),
    }),
    {
      name: 'analytics-storage',
    }
  )
)
