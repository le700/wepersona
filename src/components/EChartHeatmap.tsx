import React, { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { HeatmapData } from '../types/analytics'

interface EChartHeatmapProps {
  data: HeatmapData
  height?: number
  minColor?: string
  maxColor?: string
}

export const EChartHeatmap: React.FC<EChartHeatmapProps> = ({
  data,
  height = 280,
  minColor = '#fee5e8',
  maxColor = '#ee4567'
}) => {
  const maxValue = useMemo(() => {
    let max = 0
    for (const [, , value] of data.data) {
      if (value > max) max = value
    }
    return max || 1
  }, [data])

  const option = useMemo(() => {
    return {
      tooltip: {
        position: 'top',
        formatter: (params: any) => {
          const xLabel = data.xLabels[params.data[0]]
          const yLabel = data.yLabels[params.data[1]]
          const value = params.data[2]
          return `${yLabel} ${xLabel}<br/>消息数: <strong>${value}</strong>`
        },
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderColor: 'transparent',
        textStyle: {
          color: '#fff',
        },
      },
      grid: {
        left: 60,
        right: 20,
        top: 20,
        bottom: 60,
      },
      xAxis: {
        type: 'category',
        data: data.xLabels,
        splitArea: {
          show: true,
        },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          fontSize: 11,
          color: '#6b7280',
          interval: 0,
        },
      },
      yAxis: {
        type: 'category',
        data: data.yLabels,
        splitArea: {
          show: true,
        },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          fontSize: 11,
          color: '#6b7280',
        },
      },
      visualMap: {
        min: 0,
        max: maxValue,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        itemWidth: 10,
        itemHeight: 120,
        inRange: {
          color: [minColor, maxColor],
        },
        textStyle: {
          color: '#6b7280',
          fontSize: 11,
        },
      },
      series: [
        {
          type: 'heatmap',
          data: data.data,
          label: {
            show: false,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
        },
      ],
    }
  }, [data, maxValue, minColor, maxColor])

  return <ReactECharts option={option} style={{ height: `${height}px`, width: '100%' }} />
}
