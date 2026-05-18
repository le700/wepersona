import React, { useRef, useMemo, useEffect } from 'react'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { TooltipComponent } from 'echarts/components'
import 'echarts-wordcloud'
import type { WordcloudData } from '../types/analytics'

// 注册必要的组件
echarts.use([CanvasRenderer, TooltipComponent])

interface EChartWordcloudProps {
  data: WordcloudData
  height?: number | string
  loading?: boolean
  maxWords?: number
  colorScheme?: 'default' | 'warm' | 'cool' | 'rainbow'
  sizeScale?: number
  onWordClick?: (word: string, count: number) => void
}

const colorSchemes = {
  default: ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#22c55e', '#14b8a6', '#3b82f6'],
  warm: ['#f97316', '#fb923c', '#fbbf24', '#facc15', '#f59e0b', '#ea580c', '#dc2626', '#ef4444'],
  cool: ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#14b8a6', '#06b6d4', '#0ea5e9', '#0284c7'],
  rainbow: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'],
}

export const EChartWordcloud: React.FC<EChartWordcloudProps> = ({
  data,
  height = 400,
  loading = false,
  maxWords = 100,
  colorScheme = 'default',
  sizeScale = 1,
  onWordClick
}) => {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstanceRef = useRef<echarts.ECharts | null>(null)

  const getOption = useMemo(() => {
    const words = data.words.slice(0, maxWords)
    if (words.length === 0) return null

    // 计算最大和最小值用于归一化
    const maxCount = Math.max(...words.map((w) => w.count))
    const minCount = Math.min(...words.map((w) => w.count))
    const range = maxCount - minCount || 1

    const colors = colorSchemes[colorScheme]

    // 基础字体大小范围
    const baseSizeMin = 14
    const baseSizeMax = 56
    // 根据缩放倍率调整
    const sizeMin = Math.round(baseSizeMin * sizeScale)
    const sizeMax = Math.round(baseSizeMax * sizeScale)
    const sizeRange = sizeMax - sizeMin

    // 转换为 echarts-wordcloud 格式，每个词直接指定颜色
    const seriesData = words.map((item, index) => {
      // 归一化字体大小
      const normalized = (item.count - minCount) / range
      const fontSize = Math.round(sizeMin + normalized * sizeRange)
      // 为每个词分配一个颜色
      const color = colors[index % colors.length]

      return {
        name: item.word,
        value: item.count,
        textStyle: {
          fontSize,
          color,
        },
      }
    })

    return {
      backgroundColor: 'transparent',
      tooltip: {
        show: true,
        formatter: (params: any) => {
          const word = words.find((w) => w.word === params.name)
          const percentage = word?.percentage ? ` (${word.percentage}%)` : ''
          return `${params.name}: ${params.value}次${percentage}`
        },
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderColor: 'transparent',
        textStyle: {
          color: '#fff',
        },
      },
      series: [
        {
          type: 'wordCloud',
          shape: 'circle',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          gridSize: Math.max(2, Math.round(4 * sizeScale)),
          sizeRange: [sizeMin, sizeMax],
          rotationRange: [-45, 45],
          rotationStep: 15,
          drawOutOfBound: false,
          layoutAnimation: true,
          textStyle: {
            fontFamily: 'sans-serif',
            fontWeight: 'bold',
          },
          emphasis: {
            focus: 'self',
            textStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.3)',
            },
          },
          data: seriesData,
        },
      ],
    }
  }, [data, maxWords, colorScheme, sizeScale])

  useEffect(() => {
    if (!chartRef.current) return

    // 销毁旧实例
    if (chartInstanceRef.current) {
      chartInstanceRef.current.dispose()
    }

    // 创建新实例
    chartInstanceRef.current = echarts.init(chartRef.current)

    const option = getOption
    if (option) {
      chartInstanceRef.current.setOption(option)
    }

    // 绑定点击事件
    if (onWordClick) {
      chartInstanceRef.current.on('click', (params) => {
        if (params.componentType === 'series' && params.seriesType === 'wordCloud') {
          onWordClick(params.name, params.value as number)
        }
      })
    }

    // 窗口大小变化时重新调整
    const handleResize = () => {
      chartInstanceRef.current?.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chartInstanceRef.current?.dispose()
    }
  }, [getOption, onWordClick])

  useEffect(() => {
    if (chartInstanceRef.current) {
      const option = getOption
      if (option) {
        chartInstanceRef.current.setOption(option, { notMerge: true })
      }
    }
  }, [getOption])

  return (
    <div
      ref={chartRef}
      style={{
        height: typeof height === 'number' ? `${height}px` : height,
        width: '100%'
      }}
    />
  )
}
