export type Corner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

export function nextCorner(current: Corner): Corner {
  const corners: Corner[] = ['bottom-right', 'bottom-left', 'top-left', 'top-right']
  const idx = corners.indexOf(current)
  return corners[(idx + 1) % corners.length]
}
