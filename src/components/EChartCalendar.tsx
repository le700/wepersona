import React, { useRef, useMemo, useEffect } from 'react'
import * as echarts from 'echarts/core'
import { HeatmapChart } from 'echarts/charts'
import { CalendarComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { CalendarData } from '../types/analytics'

// 注册必要的组件
echarts.use([
  HeatmapChart,
  CalendarComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer
])

interface EChartCalendarProps {
  data: CalendarData[]
  height?: number
  year?: number
}

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

export const EChartCalendar: React.FC<EChartCalendarProps> = ({
  data,
  height = 180,
  year
}) => {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstanceRef = useRef<echarts.ECharts | null>(null)

  // 计算年份范围
  const targetYear = useMemo(() => {
    if (year) return year
    if (data.length === 0) return new Date().getFullYear()
    // 找到数据中最大的年份
    const years = data.map((d) => parseInt(d.date.split('-')[0]))
    return Math.max(...years)
  }, [data, year])

  // 计算最大值（用于颜色映射）
  const maxValue = useMemo(() => {
    if (data.length === 0) return 10
    return Math.max(...data.map((d) => d.value), 1)
  }, [data])

  // 转换数据格式为 ECharts 需要的格式
  const chartData = useMemo(() => {
    return data.map((d) => [d.date, d.value])
  }, [data])

  const getOption = useMemo(() => {
    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const date = params.data[0]
          const value = params.data[1]
          return `${date}<br/>消息数: ${value}`
        },
      },
      visualMap: {
        min: 0,
        max: maxValue,
        calculable: false,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        itemWidth: 10,
        itemHeight: 100,
        text: [`${maxValue}`, '0'],
        inRange: {
          color: ['#fee5e8', '#fbb5c2', '#f7758c', '#ee4567'],
        },
        textStyle: {
          color: '#6b7280',
          fontSize: 10,
        },
        show: true,
      },
      calendar: {
        top: 30,
        left: 40,
        right: 40,
        cellSize: [13, 13],
        range: String(targetYear),
        itemStyle: {
          borderWidth: 2,
          borderColor: '#ffffff',
        },
        yearLabel: {
          show: true,
          position: 'top',
          color: '#6b7280',
          fontSize: 12,
        },
        monthLabel: {
          show: true,
          color: '#6b7280',
          fontSize: 10,
          nameMap: MONTH_NAMES,
        },
        dayLabel: {
          show: true,
          firstDay: 1,
          color: '#9ca3af',
          fontSize: 10,
          nameMap: WEEKDAY_NAMES,
        },
        splitLine: {
          show: false,
        },
      },
      series: [
        {
          type: 'heatmap',
          coordinateSystem: 'calendar',
          data: chartData,
        },
      ],
    }
  }, [targetYear, maxValue, chartData])

  useEffect(() => {
    if (!chartRef.current) return

    // 销毁旧实例
    if (chartInstanceRef.current) {
      chartInstanceRef.current.dispose()
    }

    // 创建新实例
    chartInstanceRef.current = echarts.init(chartRef.current)
    chartInstanceRef.current.setOption({ backgroundColor: 'transparent', ...getOption })

    // 窗口大小变化时重新调整
    const handleResize = () => {
      chartInstanceRef.current?.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chartInstanceRef.current?.dispose()
    }
  }, [getOption])

  useEffect(() => {
    if (chartInstanceRef.current) {
      chartInstanceRef.current.setOption({ backgroundColor: 'transparent', ...getOption }, { notMerge: true })
    }
  }, [getOption])

  return (
    <div
      ref={chartRef}
      style={{
        height: `${height}px`,
        width: '100%'
      }}
    />
  )
}
