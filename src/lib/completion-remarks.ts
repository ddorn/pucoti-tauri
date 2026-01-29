/**
 * Generate a contextual remark based on estimation error percentage
 */
export function getCompletionRemark(errorPercent: number): string {
  const absError = Math.abs(errorPercent)

  // Perfect estimation (within ±5%)
  if (absError <= 5) {
    const remarks = ['Perfect!', 'Nailed it!', 'Spot on!', 'Impressive!']
    return remarks[Math.floor(Math.random() * remarks.length)]
  }

  // Great estimation (within ±10%)
  if (absError <= 10) {
    const remarks = ['Nice!', 'Well done!', 'Good estimate!', 'Pretty close!']
    return remarks[Math.floor(Math.random() * remarks.length)]
  }

  // Underestimated (finished faster than predicted)
  if (errorPercent < 0) {
    if (absError <= 25) {
      const remarks = ['Faster than expected!', 'Speed boost!', 'Quick work!']
      return remarks[Math.floor(Math.random() * remarks.length)]
    } else {
      const remarks = ['Speed demon!', 'That was quick!', 'Lightning fast!']
      return remarks[Math.floor(Math.random() * remarks.length)]
    }
  }

  // Overestimated (took longer than predicted)
  if (absError <= 25) {
    const remarks = ['Not bad', 'Close enough', 'Getting there']
    return remarks[Math.floor(Math.random() * remarks.length)]
  }

  if (absError <= 50) {
    const remarks = ['Room for improvement', 'Keep calibrating', 'Getting better']
    return remarks[Math.floor(Math.random() * remarks.length)]
  }

  // Significantly overestimated
  const remarks = ['Did you leave the timer running?', 'Quite a bit longer', 'Way off this time']
  return remarks[Math.floor(Math.random() * remarks.length)]
}

/**
 * Format the error percentage as a human-readable string
 */
export function formatErrorPercent(errorPercent: number): string {
  const absError = Math.abs(errorPercent).toFixed(0)

  if (errorPercent > 0) {
    return `${absError}% longer than predicted`
  } else if (errorPercent < 0) {
    return `${absError}% less time than predicted`
  } else {
    return 'exactly on time'
  }
}
