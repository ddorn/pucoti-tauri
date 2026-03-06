import { useMemo } from 'react'
import { Subheading } from './catalyst/heading'
import { Text } from './catalyst/text'
import { calibrationColor } from '../lib/stats'
import type { HeatmapData } from '../hooks/useStats'

const CELL_SIZE = 20
const GAP = 4
const STEP = CELL_SIZE + GAP
const MAX_RADIUS = CELL_SIZE / 2 - 1
const MIN_RADIUS = 3
const LABEL_WIDTH = 40
const SUMMARY_GAP = 24
const MONTH_LABEL_HEIGHT = 22

// Monday-first order: Mon=0, Tue=1, ..., Sun=6
// Maps from our row index to JS getDay() value
const ROW_TO_JS_DAY = [1, 2, 3, 4, 5, 6, 0] // Mon, Tue, Wed, Thu, Fri, Sat, Sun
const JS_DAY_TO_ROW: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 }
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface DayCell {
  date: string
  col: number
  row: number // 0=Mon, 6=Sun
  onTimeRate: number | null
  sessionCount: number
}

function generateDateGrid(days: HeatmapData['days']): {
  cells: DayCell[]
  weeks: number
  monthLabels: { label: string; col: number }[]
} {
  const dayMap = new Map(days.map(d => [d.date, d]))

  const end = new Date()
  const start = new Date()
  start.setMonth(start.getMonth() - 6)
  // Align to start of week (Monday)
  const dayOfWeek = start.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  start.setDate(start.getDate() + mondayOffset)

  const cells: DayCell[] = []
  const monthLabels: { label: string; col: number }[] = []
  const seenMonths = new Set<string>()

  let col = 0
  const current = new Date(start)

  while (current <= end) {
    const jsDay = current.getDay()
    const row = JS_DAY_TO_ROW[jsDay]
    const dateKey = formatDateKey(current)

    // Track month labels at Monday of each new month
    const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`
    if (!seenMonths.has(monthKey) && jsDay === 1) {
      seenMonths.add(monthKey)
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      monthLabels.push({ label: monthNames[current.getMonth()], col })
    }

    const data = dayMap.get(dateKey)
    cells.push({
      date: dateKey,
      col,
      row,
      onTimeRate: data?.onTimeRate ?? null,
      sessionCount: data?.sessionCount ?? 0,
    })

    current.setDate(current.getDate() + 1)
    // New week starts on Monday
    if (current.getDay() === 1) col++
  }

  return { cells, weeks: col + 1, monthLabels }
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function radiusScale(count: number, maxCount: number): number {
  if (count === 0) return 2
  if (maxCount <= 1) return MAX_RADIUS
  const t = Math.sqrt(count / maxCount)
  return MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS)
}

export function CalibrationHeatmap({ data }: { data: HeatmapData }) {
  const hasData = data.days.length > 0

  const grid = useMemo(() => generateDateGrid(data.days), [data.days])

  const maxSessionCount = useMemo(
    () => Math.max(1, ...grid.cells.map(c => c.sessionCount)),
    [grid.cells]
  )

  const maxWeekdayCount = useMemo(
    () => Math.max(1, ...data.weekdays.map(w => w.sessionCount)),
    [data.weekdays]
  )

  const gridWidth = grid.weeks * STEP
  const summaryColX = LABEL_WIDTH + gridWidth + SUMMARY_GAP
  const svgWidth = summaryColX + STEP + 8
  const svgHeight = MONTH_LABEL_HEIGHT + 7 * STEP

  return (
    <div className="bg-surface-raised rounded-lg p-4">
      <div className="mb-4">
        <Subheading level={2}>Prediction Activity & Calibration</Subheading>
        <Text className="text-zinc-400 mt-1">
          Color shows calibration quality. Larger dots mean more predictions that day.
        </Text>
      </div>
      {hasData ? (
        <div className="overflow-x-auto">
          <svg
            width={svgWidth}
            height={svgHeight + 48}
            className="block"
          >
            {/* Month labels */}
            {grid.monthLabels.map(({ label, col }) => (
              <text
                key={`month-${col}`}
                x={LABEL_WIDTH + col * STEP + CELL_SIZE / 2}
                y={MONTH_LABEL_HEIGHT - 6}
                textAnchor="start"
                className="fill-zinc-400 text-xs"
              >
                {label}
              </text>
            ))}

            {/* Summary column header */}
            <text
              x={summaryColX + CELL_SIZE / 2}
              y={MONTH_LABEL_HEIGHT - 6}
              textAnchor="middle"
              className="fill-zinc-400 text-xs"
            >
              Avg
            </text>

            {/* Weekday labels - all days, starting Monday */}
            {WEEKDAY_LABELS.map((label, row) => (
              <text
                key={`day-${row}`}
                x={LABEL_WIDTH - 6}
                y={MONTH_LABEL_HEIGHT + row * STEP + CELL_SIZE / 2 + 4}
                textAnchor="end"
                className="fill-zinc-400 text-xs"
              >
                {label}
              </text>
            ))}

            {/* Day cells */}
            {grid.cells.map(cell => (
              <circle
                key={cell.date}
                cx={LABEL_WIDTH + cell.col * STEP + CELL_SIZE / 2}
                cy={MONTH_LABEL_HEIGHT + cell.row * STEP + CELL_SIZE / 2}
                r={radiusScale(cell.sessionCount, maxSessionCount)}
                fill={cell.sessionCount > 0 ? calibrationColor(cell.onTimeRate) : '#27272a'}
                opacity={cell.sessionCount > 0 ? 1 : 0.3}
              >
                <title>
                  {cell.date}
                  {cell.sessionCount > 0
                    ? `\n${cell.sessionCount} prediction${cell.sessionCount !== 1 ? 's' : ''}\nOn-time: ${cell.onTimeRate !== null ? Math.round(cell.onTimeRate) + '%' : 'N/A'}`
                    : '\nNo predictions'}
                </title>
              </circle>
            ))}

            {/* Separator line */}
            <line
              x1={summaryColX - SUMMARY_GAP / 2}
              y1={MONTH_LABEL_HEIGHT}
              x2={summaryColX - SUMMARY_GAP / 2}
              y2={MONTH_LABEL_HEIGHT + 7 * STEP - GAP}
              stroke="#3f3f46"
              strokeWidth={1}
            />

            {/* Weekday summary column (reordered to Monday-first) */}
            {WEEKDAY_LABELS.map((_, row) => {
              const jsDay = ROW_TO_JS_DAY[row]
              const w = data.weekdays.find(wd => wd.day === jsDay)
              if (!w) return null
              return (
                <circle
                  key={`summary-${row}`}
                  cx={summaryColX + CELL_SIZE / 2}
                  cy={MONTH_LABEL_HEIGHT + row * STEP + CELL_SIZE / 2}
                  r={w.sessionCount > 0 ? radiusScale(w.sessionCount, maxWeekdayCount) : 2}
                  fill={w.sessionCount > 0 ? calibrationColor(w.onTimeRate) : '#27272a'}
                  opacity={w.sessionCount > 0 ? 1 : 0.3}
                >
                  <title>
                    {WEEKDAY_LABELS[row]} average
                    {w.sessionCount > 0
                      ? `\n${w.sessionCount} total predictions\nOn-time: ${w.onTimeRate !== null ? Math.round(w.onTimeRate) + '%' : 'N/A'}`
                      : '\nNo predictions'}
                  </title>
                </circle>
              )
            })}

            {/* Color scale legend */}
            <g transform={`translate(${LABEL_WIDTH}, ${svgHeight + 14})`}>
              <text x={0} y={12} className="fill-zinc-400 text-xs">
                Poor
              </text>
              {Array.from({ length: 20 }, (_, i) => {
                const rate = (i / 19) * 100
                return (
                  <rect
                    key={i}
                    x={36 + i * 10}
                    y={2}
                    width={10}
                    height={14}
                    rx={0}
                    fill={calibrationColor(rate)}
                  />
                )
              })}
              <text x={36 + 20 * 10 + 8} y={12} className="fill-zinc-400 text-xs">
                Great
              </text>
            </g>
          </svg>
        </div>
      ) : (
        <div className="flex items-center justify-center h-32">
          <Text>Complete prediction sessions to see activity patterns</Text>
        </div>
      )}
    </div>
  )
}
