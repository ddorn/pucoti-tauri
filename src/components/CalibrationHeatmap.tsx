import { useMemo, useRef, useEffect } from 'react'
import { Subheading } from './catalyst/heading'
import { Text } from './catalyst/text'
import { calibrationColor } from '../lib/stats'
import type { HeatmapData } from '../hooks/useStats'

const CELL_SIZE = 26
const GAP = 4
const STEP = CELL_SIZE + GAP
const MAX_RADIUS = 15
const MIN_RADIUS = 6
const FONT_SIZE = 10
const LABEL_WIDTH = 40
const MONTH_LABEL_HEIGHT = 22
const GRID_HEIGHT = MONTH_LABEL_HEIGHT + 7 * STEP

// Right panel: 8px gap after separator, circle centered
const RIGHT_CX = 8 + CELL_SIZE / 2  // = 22
const RIGHT_PANEL_WIDTH = RIGHT_CX + CELL_SIZE / 2 + 6  // = 42

// Monday-first order: Mon=0, Tue=1, ..., Sun=6
const ROW_TO_JS_DAY = [1, 2, 3, 4, 5, 6, 0]
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
  const defaultStart = new Date()
  defaultStart.setFullYear(defaultStart.getFullYear() - 1)

  // Always show at least 12 months; show more if data goes further back
  let startBase = defaultStart
  if (days.length > 0) {
    const minDate = new Date(days.reduce((min, d) => d.date < min ? d.date : min, days[0].date))
    if (minDate < defaultStart) startBase = minDate
  }

  const start = new Date(startBase)
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
  const scrollRef = useRef<HTMLDivElement>(null)

  const grid = useMemo(() => generateDateGrid(data.days), [data.days])

  const maxSessionCount = useMemo(
    () => Math.max(1, ...grid.cells.map(c => c.sessionCount)),
    [grid.cells]
  )

  const maxWeekdayCount = useMemo(
    () => Math.max(1, ...data.weekdays.map(w => w.sessionCount)),
    [data.weekdays]
  )

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [grid.weeks])

  const gridWidth = grid.weeks * STEP

  return (
    <div className="bg-surface-raised rounded-lg p-4">
      <div className="mb-4">
        <Subheading level={2}>Your prediction calendar</Subheading>
        <Text className="text-zinc-400 mt-1">
          Color shows how accurate your predictions were. Larger dots mean more predictions that day.
        </Text>
      </div>
      {hasData ? (
        <div>
          <div className="flex">
            {/* Left: fixed weekday labels */}
            <div
              className="flex-shrink-0 border-r border-zinc-700"
              style={{ boxShadow: '4px 0 12px -2px rgba(0,0,0,0.7)', zIndex: 1 }}
            >
            <svg width={LABEL_WIDTH} height={GRID_HEIGHT}>
              {WEEKDAY_LABELS.map((label, row) => (
                <text
                  key={row}
                  x={LABEL_WIDTH - 6}
                  y={MONTH_LABEL_HEIGHT + row * STEP + CELL_SIZE / 2 + 4}
                  textAnchor="end"
                  className="fill-zinc-300 text-sm"
                >
                  {label}
                </text>
              ))}
            </svg>
            </div>

            {/* Middle: scrollable month grid */}
            <div ref={scrollRef} className="overflow-x-auto min-w-0 px-1">
              <svg width={gridWidth} height={GRID_HEIGHT} className="block">
                {/* Month labels */}
                {grid.monthLabels.map(({ label, col }) => (
                  <text
                    key={`month-${col}`}
                    x={col * STEP + CELL_SIZE / 2}
                    y={MONTH_LABEL_HEIGHT - 6}
                    textAnchor="middle"
                    className="fill-zinc-300 text-sm"
                  >
                    {label}
                  </text>
                ))}

                {/* Day cells */}
                {grid.cells.map(cell => {
                  const cx = cell.col * STEP + CELL_SIZE / 2
                  const cy = MONTH_LABEL_HEIGHT + cell.row * STEP + CELL_SIZE / 2
                  const r = radiusScale(cell.sessionCount, maxSessionCount)
                  const dayNum = parseInt(cell.date.split('-')[2])
                  return (
                    <g key={cell.date}>
                      {cell.sessionCount > 0 && (
                        <circle cx={cx} cy={cy} r={r} fill={calibrationColor(cell.onTimeRate)} />
                      )}
                      <text
                        x={cx}
                        y={cy}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={FONT_SIZE}
                        fill={cell.sessionCount > 0 ? 'white' : '#a1a1aa'}
                        style={{ userSelect: 'none', pointerEvents: 'none' }}
                      >
                        {dayNum}
                      </text>
                      <title>
                        {cell.date}
                        {cell.sessionCount > 0
                          ? `\n${cell.sessionCount} prediction${cell.sessionCount !== 1 ? 's' : ''}\nOn-time: ${cell.onTimeRate !== null ? Math.round(cell.onTimeRate) + '%' : 'N/A'}`
                          : '\nNo predictions'}
                      </title>
                    </g>
                  )
                })}
              </svg>
            </div>

            {/* Right: fixed Avg column */}
            <div className="flex-shrink-0 border-l border-zinc-700" style={{ boxShadow: '-4px 0 12px -2px rgba(0,0,0,0.7)', zIndex: 1 }}>
              <svg width={RIGHT_PANEL_WIDTH} height={GRID_HEIGHT} className="block">
                <text
                  x={RIGHT_CX}
                  y={MONTH_LABEL_HEIGHT - 6}
                  textAnchor="middle"
                  className="fill-zinc-300 text-sm"
                >
                  Avg
                </text>
                {WEEKDAY_LABELS.map((_, row) => {
                  const jsDay = ROW_TO_JS_DAY[row]
                  const w = data.weekdays.find(wd => wd.day === jsDay)
                  if (!w) return null
                  return (
                    <circle
                      key={`summary-${row}`}
                      cx={RIGHT_CX}
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
              </svg>
            </div>
          </div>

          {/* Color scale legend */}
          <div className="mt-3" style={{ paddingLeft: LABEL_WIDTH }}>
            <div className="flex">
              {Array.from({ length: 20 }, (_, i) => (
                <div
                  key={i}
                  style={{ width: 10, height: 10, backgroundColor: calibrationColor((i / 19) * 100) }}
                />
              ))}
            </div>
            <div className="flex items-center gap-4 mt-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: calibrationColor(0) }} />
                <span className="text-xs text-zinc-400">Underestimate</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: calibrationColor(80) }} />
                <span className="text-xs text-zinc-400">Calibrated</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: calibrationColor(100) }} />
                <span className="text-xs text-zinc-400">Overestimate</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-32">
          <Text>Complete prediction sessions to see activity patterns</Text>
        </div>
      )}
    </div>
  )
}
