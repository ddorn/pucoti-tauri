import { useEffect, useRef } from 'react'
import Plotly from '../lib/plotly-custom'
import { Text } from './catalyst/text'
import { createPlotLayout, createPlotConfig } from '../lib/plot-config'
import type { Granularity } from '../lib/stats'
import type { PeriodData } from '../hooks/useStats'

/** Fill gaps in period data with empty entries so the chart shows continuous time */
function fillGaps(data: PeriodData[], granularity: Granularity): { period: string; data: PeriodData | null }[] {
  if (data.length === 0) return []

  const dataMap = new Map(data.map(d => [d.period, d]))

  if (granularity === 'day') {
    const result: { period: string; data: PeriodData | null }[] = []
    const start = parseDate(data[0].period)
    const end = parseDate(data[data.length - 1].period)
    const current = new Date(start)
    while (current <= end) {
      const key = formatDateKey(current)
      result.push({ period: key, data: dataMap.get(key) ?? null })
      current.setDate(current.getDate() + 1)
    }
    return result
  }

  if (granularity === 'month') {
    const result: { period: string; data: PeriodData | null }[] = []
    const [startY, startM] = data[0].period.split('-').map(Number)
    const [endY, endM] = data[data.length - 1].period.split('-').map(Number)
    let y = startY, m = startM
    while (y < endY || (y === endY && m <= endM)) {
      const key = `${y}-${String(m).padStart(2, '0')}`
      result.push({ period: key, data: dataMap.get(key) ?? null })
      m++
      if (m > 12) { m = 1; y++ }
    }
    return result
  }

  // Week: fill gaps too
  return data.map(d => ({ period: d.period, data: d }))
}

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Parse "YYYY-Www" and return the Monday Date of that ISO week */
function isoWeekToMonday(weekKey: string): Date {
  const [yearStr, weekStr] = weekKey.split('-W')
  const year = parseInt(yearStr)
  const week = parseInt(weekStr)
  // Jan 4 is always in ISO week 1; find its Monday
  const jan4 = new Date(year, 0, 4)
  const jan4DayOfWeek = jan4.getDay() || 7 // 1=Mon … 7=Sun
  const week1Monday = new Date(jan4)
  week1Monday.setDate(jan4.getDate() - (jan4DayOfWeek - 1))
  const monday = new Date(week1Monday)
  monday.setDate(week1Monday.getDate() + (week - 1) * 7)
  return monday
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Format a week key as "Jan 27 – Feb 2" for hover tooltips */
function weekRangeLabel(weekKey: string): string {
  const monday = isoWeekToMonday(weekKey)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (d: Date) => `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`
  return `${fmt(monday)} – ${fmt(sunday)}`
}

function formatPeriodLabels(entries: { period: string }[], granularity: Granularity): string[] {
  if (granularity === 'month') {
    return entries.map(e => {
      const [y, m] = e.period.split('-')
      return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`
    })
  }

  if (granularity === 'week') {
    let lastMonth = ''
    let lastYear = ''
    return entries.map(e => {
      const monday = isoWeekToMonday(e.period)
      const y = String(monday.getFullYear())
      const m = String(monday.getMonth() + 1).padStart(2, '0')
      const monthName = MONTH_NAMES[monday.getMonth()]
      const dayNum = monday.getDate()

      if (y !== lastYear) {
        lastYear = y
        lastMonth = m
        return `${monthName} ${dayNum}, ${y}`
      }
      if (m !== lastMonth) {
        lastMonth = m
        return `${monthName} ${dayNum}`
      }
      return `${monthName} ${dayNum}`
    })
  }

  // Day: "Mar 1" on month change, then just "2", "3", etc.
  let lastMonth = ''
  let lastYear = ''
  return entries.map(e => {
    const [y, m, day] = e.period.split('-')
    const monthName = MONTH_NAMES[parseInt(m) - 1]
    const dayNum = parseInt(day)

    if (y !== lastYear) {
      lastYear = y
      lastMonth = m
      return `${monthName} ${dayNum}, ${y}`
    }
    if (m !== lastMonth) {
      lastMonth = m
      return `${monthName} ${dayNum}`
    }
    return `${dayNum}`
  })
}

interface Props {
  data: PeriodData[]
  granularity: Granularity
  barColor: string
}

export function CalibrationOverTimeChart({ data, granularity, barColor }: Props) {
  const plotRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (data.length === 0) return
    const container = plotRef.current
    if (!container) return

    const filled = fillGaps(data, granularity)
    const labels = formatPeriodLabels(filled, granularity)
    const showErrorBars = granularity !== 'day'

    // Use integer indices as x-values to avoid Plotly merging duplicate label strings
    // (e.g. "25" for Jan 25 and Feb 25 would otherwise be treated as one category)
    const indices = filled.map((_, i) => i)

    const barTrace: Plotly.Data = {
      x: indices,
      y: filled.map(e => e.data?.onTime.rate ?? 0),
      type: 'bar',
      name: 'On-time rate',
      marker: {
        color: filled.map(e => e.data ? barColor : 'transparent'),
      },
      hovertemplate: filled.map((e, i) => {
        const periodLabel = granularity === 'week' ? weekRangeLabel(e.period) : labels[i]
        return e.data
          ? `${periodLabel}<br>On-time: ${Math.round(e.data.onTime.rate)}%<br>${e.data.sessionCount} prediction${e.data.sessionCount !== 1 ? 's' : ''}<extra></extra>`
          : `${periodLabel}<br>No predictions<extra></extra>`
      }),
    }

    if (showErrorBars) {
      barTrace.error_y = {
        type: 'data',
        symmetric: false,
        array: filled.map(e => e.data ? e.data.onTime.ci95High - e.data.onTime.rate : 0),
        arrayminus: filled.map(e => e.data ? e.data.onTime.rate - e.data.onTime.ci95Low : 0),
        color: '#a1a1aa',
        thickness: 1.5,
        width: 4,
      }
    }

    const layout = createPlotLayout({
      xaxis: {
        gridcolor: '#27272a',
        tickangle: granularity === 'day' && filled.length > 20 ? -45 : 0,
        tickmode: 'array',
        tickvals: indices,
        ticktext: labels,
        range: [-0.7, filled.length - 0.3],
      },
      yaxis: {
        title: { text: 'Predictions correct (%)', font: { color: '#a1a1aa' } },
        gridcolor: '#27272a',
        range: [0, 105],
      },
      showlegend: false,
      bargap: 0.3,
      // Use shapes for the 80% reference line — spans full plot width regardless of data
      shapes: [{
        type: 'line',
        xref: 'paper',
        x0: 0,
        x1: 1,
        y0: 80,
        y1: 80,
        line: { color: '#22c55e', width: 2, dash: 'dash' },
      }],
    })

    Plotly.newPlot(container, [barTrace], layout, createPlotConfig())

    return () => { Plotly.purge(container) }
  }, [data, granularity, barColor])

  return (
    <div className="bg-surface-raised rounded-lg p-4">
      {data.length > 0 ? (
        <div ref={plotRef} className="w-full h-72" />
      ) : (
        <div className="flex items-center justify-center h-72">
          <Text>Complete prediction sessions to see calibration trends</Text>
        </div>
      )}
    </div>
  )
}
