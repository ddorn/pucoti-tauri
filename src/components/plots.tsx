// Centralized lazy-loaded plot components
// Import from here instead of individual plot files to get automatic code-splitting

import { lazy, Suspense } from 'react'
import type { ComponentProps } from 'react'
import { Text } from './catalyst/text'

// Lazy load the actual plot components
const CalibrationPlotLazy = lazy(() => import('./CalibrationPlot').then(m => ({ default: m.CalibrationPlot })))
const AdjustmentPlotLazy = lazy(() => import('./AdjustmentPlot').then(m => ({ default: m.AdjustmentPlot })))
const EstimationHistogramLazy = lazy(() => import('./EstimationHistogram').then(m => ({ default: m.EstimationHistogram })))

// Loading fallback for plots
function PlotSkeleton({ height = 'h-72' }: { height?: string }) {
  return (
    <div className={`bg-surface-raised rounded-lg p-4 ${height} flex items-center justify-center`}>
      <Text>Loading chart...</Text>
    </div>
  )
}

// Export wrapped versions with Suspense built-in
export function CalibrationPlot(props: ComponentProps<typeof CalibrationPlotLazy>) {
  return (
    <Suspense fallback={<PlotSkeleton />}>
      <CalibrationPlotLazy {...props} />
    </Suspense>
  )
}

export function AdjustmentPlot(props: ComponentProps<typeof AdjustmentPlotLazy>) {
  return (
    <Suspense fallback={<PlotSkeleton />}>
      <AdjustmentPlotLazy {...props} />
    </Suspense>
  )
}

export function EstimationHistogram(props: ComponentProps<typeof EstimationHistogramLazy>) {
  return (
    <Suspense fallback={<div className="w-full h-48" />}>
      <EstimationHistogramLazy {...props} />
    </Suspense>
  )
}
