interface RemarkGroup {
  range: [number, number] // [min, max) percentage range (upper bound exclusive)
  absolute?: boolean // if true, apply to |errorPercent|; defaults to false
  weight?: number // probability weight (1 = common, <1 = rare); defaults to 1
  texts: string[] // array of remark texts that share this range/weight
}

const REMARKS: RemarkGroup[] = [
  // Perfect calibration (0-1%) - most supportive
  {
    range: [0, 1],
    absolute: true,
    texts: [
      'Perfect!',
      'Nailed it!',
      'Spot on!',
      'Incredible calibration!',
      'Master of time!',
      "You waited for the timer to hit zero, right?",
    ],
  },
  { range: [0, 1], absolute: true, weight: 0.05, texts: ["You're a time wizard!", 'Teach me your ways', 'Psychic!', 'Are you from the well calibrated future?'] },
  {
    range: [0, 1],
    absolute: true,
    weight: 0.05,
    texts: [
      "Maybe you are the sharpest tool in the shed?",
      "Maybe you are the brightest crayon in the box?",
      "Maybe you are the sharpest knife in the drawer?",
    ],
  },
  {
    range: [0.2, 1],
    weight: 0.1,
    texts: ["Aha! You just missed the bell :p"],
  },

  // Excellent calibration (1-10%)
  {
    range: [1, 10],
    absolute: true,
    texts: [
      'Great estimate!',
      'Well calibrated!',
      'Nice one!',
      'Pretty close!',
      'Solid prediction!',
      'Impressive!',
    ],
  },
  { range: [1, 10], absolute: true, weight: 0.1, texts: ["That's the way (I like it)!"]},

  // Good calibration (10-50%)
  {
    range: [10, 50],
    absolute: true,
    texts: [
      'Not bad!',
      'Getting better!',
      'On the right track!',
      'Keep going!',
      'Pretty decent',
      'Calibration in progress',
      'In the ballpark'
    ],
  },
  { range: [10, 50], absolute: true, weight: 0.08, texts: ['Close enough for jazz'] },

  // Specials at specific values
  { range: [42, 43], absolute: true, weight: 0.2, texts: ['This must be the answer.', "Don't panic!"] },
  { range: [69, 70], absolute: true, weight: 0.001, texts: ['Nice!', 'Voulez-vous coucher avec moi ce soir?'] },
  { range: [100, 101], absolute: true, weight: 1, texts: ["Perfect score! Oh wait..."] },

  // Moderate miscalibration (50-100%)
  {
    range: [50, 100],
    absolute: true,
    texts: [
      'Keep calibrating!',
      "You'll get there!",
      'Every estimate helps',
      'Learning curve in action',
      'Quite a bit off',
      'Not bad. Also not good.'
    ],
  },
  { range: [50, 100], absolute: true, weight: 0.06, texts: ['Ballpark? More like ball-continent'] },

  // Significant miscalibration (100-200%)
  {
    range: [100, 200],
    texts: [
      'Way off this time',
      'That was... ambitious',
      'Back to the drawing board',
      'Did you leave the timer running?',
      'Calibration needed!',
      'Data point acquired',
      'Room for improvement',
    ],
  },
  { range: [100, 200], weight: 0.06, texts: ['Time to recalibrate that crystal ball'] },

  // Very significant miscalibration (200-400%)
  {
    range: [200, Infinity],
    texts: [
      'Wow, that was way off!',
      'The universe had other plans',
      'Time estimation is hard',
      'Task took an unexpected plot twist',
      "Hofstadter's Law strikes again",
      'Maybe take a break?',
      'You know the goal is to have a small number, right?',
      'That escalated quickly',
      'Maybe break it into smaller tasks?',
    ],
  },
  {
    range: [200, Infinity],
    weight: 0.05,
    texts: [
      'Were you estimating in dog years?',
      'Time warped on you',
      "Isn't time an illusion anyway?",
      "Did you time travel the wrong way?",
      "Are you the sharpest tool in the shed?",
      "Are you the brightest crayon in the box?",
      "Are you the sharpest knife in the drawer?",
    ],
  },

  {
    range: [400, Infinity],
    texts: [
      'The plots will look terrible with a stretched x-axis',
      'Do I really have to record this?? Yes.',
      "This is why averages are a bad.",
      "I could say it happens to everyone, but I'm not sure."
    ],
  },

  // Anytime
  {
    range: [-Infinity, Infinity],
    weight: 0.01,
    texts: [
      "Don't forget to drink water!",
      "If you like it, share it!",
    ],
  },
  {
    range: [-Infinity, Infinity],
    weight: 0.001,
    texts: [
      "Don't eat soup with a fork.",
    ],
  }
]

/**
 * Select a random element from an array using weighted probabilities
 */
function weightedRandom<T extends { weight: number }>(items: T[]): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
  let random = Math.random() * totalWeight

  for (const item of items) {
    random -= item.weight
    if (random <= 0) {
      return item
    }
  }

  // Fallback (shouldn't happen)
  return items[items.length - 1]
}

/**
 * Generate a contextual remark based on estimation error percentage
 */
export function getCompletionRemark(errorPercent: number): string {
  // Filter remark groups that apply to this error percentage
  // errorPercent can be negative (underestimated) or positive (overestimated)
  const applicableGroups = REMARKS.filter((group) => {
    const absolute = group.absolute ?? false
    const value = absolute ? Math.abs(errorPercent) : errorPercent
    // Upper bound is exclusive: [min, max)
    return value >= group.range[0] && value < group.range[1]
  })

  if (applicableGroups.length === 0) {
    return 'Task completed!'
  }

  // Apply default weight of 1 if not specified
  const groupsWithWeights = applicableGroups.map((g) => ({
    ...g,
    weight: g.weight ?? 1,
  }))

  // Pick a group using weighted random selection
  const selectedGroup = weightedRandom(groupsWithWeights)

  // Pick a random text from the selected group
  const randomIndex = Math.floor(Math.random() * selectedGroup.texts.length)
  return selectedGroup.texts[randomIndex]
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
