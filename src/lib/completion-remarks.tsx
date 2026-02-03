import type React from 'react'

interface RemarkGroup {
  range: [number, number] // [min, max) percentage range (upper bound exclusive)
  absolute?: boolean // if true, apply to |errorPercent|; defaults to false
  weight?: number // probability weight (1 = common, <1 = rare); defaults to 1
  texts: (string | React.ReactElement)[] // array of remark texts that share this range/weight
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
      "You waited for the timer to hit zero, right?",
      'The prophecy was correct',
      'Did time just... obey you?',
      'Your brain has a built-in atomic clock',
      'Suspiciously accurate',
      'Flawless victory',
    ],
  },
  {
    range: [0, 1],
    absolute: true,
    weight: 0.05,
    texts: [
      'Teach me your ways',
      "You're a wizard, Harry",
      "I'm telling the other timers about you",
      'The Oracle of Delphi has competition',
      'You should be estimating for NASA',
      'Was this a lucky guess or are you actually magic?',
      "It's super effective!",
      "Bayes would be proud",
      "Reference class: consulted",
      "This was a triumph",
    ],
  },
  {
    range: [0, 0.5],
    absolute: true,
    weight: 0.001,
    texts: [
      'Your future biographer will mention this',
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
      'Pretty close!',
      'Solid prediction!',
      'My statistics module is pleased',
      'Past you knew what they were doing',
      'Within the margin of error of most science experiments',
      'Your internal clock is well-oiled',
      'This is the way',
      'Certified calibrated',
      'You\'ve done this before, haven\'t you?',
      'Respectable. Very respectable.',
      'Most impressive',
    ],
  },
  { range: [1, 10], absolute: true, weight: 0.1, texts: ["That's the way (I like it)!", "Chef's kiss"]},
  { range: [1, 10], absolute: true, weight: 0.05, texts: ['I find your lack of error... refreshing', 'Precision. German engineering.']},

  // Good calibration (10-50%)
  {
    range: [10, 50],
    absolute: true,
    texts: [
      'Not bad!',
      'Getting better!',
      'Calibration in progress',
      'In the ballpark',
      'Order of magnitude: correct',
      'Within one coffee break of accuracy',
      'Not a bullseye, but you hit the target',
      'The dart landed on the board',
      'B+ energy',
      'Would round to correct',
      'The algorithm approves (barely)',
    ],
  },
  {
    range: [10, 50],
    absolute: true,
    weight: 0.05,
    texts: [
      'Pretty decent for a human',
    ],
  },

  // Specials at specific values
  { range: [42, 43], absolute: true, weight: 0.2, texts: ['This must be the answer.', "Don't panic!"] },
  { range: [50, 51], absolute: true, weight: 0.15, texts: ['Perfectly balanced, as all things should be'] },
  { range: [60, 61], absolute: true, weight: 0.15, texts: ['60% of the time, it works every time'] },
  { range: [69, 70], absolute: true, weight: 0.01, texts: ['Nice!'] },
  { range: [69, 70], absolute: true, weight: 0.001, texts: ['Voulez-vous coucher avec moi ce soir?'] },
  { range: [99, 100], absolute: true, weight: 1, texts: ['So close yet so far'] },
  { range: [100, 101], absolute: true, weight: 1, texts: ["Perfect score! Oh wait..."] },

  // Moderate miscalibration (50-100%) - absolute
  {
    range: [50, 100],
    absolute: true,
    texts: [
      'Keep calibrating!',
      "You'll get there!",
      'Every estimate helps',
      'Learning curve in action',
      'Quite a bit off',
      'Not bad. Also not good.',
      'Reality had notes',
      'A for effort, C for calibration',
      'Your estimate was... directionally correct',
      'Time dilation, probably',
      'Somewhere in a parallel universe, you nailed it',
      'We\'ll call this a learning opportunity',
      'The spirit was willing but the estimate was weak',
      'Room for improvement',
      'This is fine',
      'Mistakes were made',
      'It\'s not a bug, it\'s a feature',
      "Inside view: betrayed you again",
      "The map ≠ the territory, apparently",
    ],
  },
  { range: [50, 100], absolute: true, weight: 0.06, texts: ['Ballpark? More like ball-continent'] },
  { range: [50, 100], absolute: true, weight: 0.01, texts: ['F'] },

  // Moderate miscalibration (50-100%) - overestimate only
  {
    range: [50, 100],
    absolute: false,
    texts: [
      'Physics got in the way',
      'The universe added a surcharge',
      'Past you had no idea what the universe had in store',
    ],
  },
  // Moderate miscalibration (50-100%) - underestimate only
  {
    range: [-100, -50],
    absolute: false,
    texts: [
      'Prediction failed successfully',
    ],
  },

  // Significant miscalibration (100-200%) - always overestimate
  {
    range: [100, 200],
    texts: [
      'Way off this time',
      'Back to the drawing board',
      'Did you leave the timer running?',
      'Calibration needed!',
      'Room, no... house for improvement!cr',
      'The spreadsheet is concerned',
      'Your estimate was more of a suggestion',
      'The gap between theory and practice',
      'Reality called, it\'s laughing',
      'This will make the average more... interesting',
      'That was... ambitious',
      'Planning fallacy sends its regards',
      'Past you was an optimist',
      'The task had other plans',
      'Ambition detected',
      'This is why agile exists',
      'Somewhere, a project manager felt a disturbance',
      'Optimism is a beautiful thing',
      'Understandable, have a nice day',
      "Your confidence intervals need work",
      "Not bad, for a first attempt"
    ],
  },
  { range: [100, 200], weight: 0.1, texts: ['What the fork?', "Moloch sends his regards",] },
  { range: [100, 200], weight: 0.06, texts: ['Time to recalibrate that crystal ball 🔮', "Epistemic status: confused"] },

  // Very significant miscalibration (200%+) - always overestimate
  {
    range: [200, Infinity],
    texts: [
      'Wow, that was way off!',
      'Time estimation is hard',
      'Task took an unexpected plot twist',
      "Hofstadter's Law strikes again",
      'Maybe take a break?',
      'You know the goal is to have a small number, right?',
      'That escalated quickly',
      'Let\'s never speak of this again',
      'Your estimate and reality need couples therapy',
      'Did you estimate for a different task?',
      'At least it\'s over now',
      'I\'ll file this under \'character building\'',
      'Your internal clock is on vacation',
      'Bold. Very bold.',
      'The universe had other plans',
      'Were you measuring in Mars years?',
      'Were you estimating in dog years?',
      'Scope creep sends its regards',
      'The real estimate was the friends we made along the way',
      'Time warped on you',
      "Did you time travel the wrong way?",
      'What a terrible night to have a curse',
      'It was at this moment he knew... he messed up',
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

  // Finished early (underestimate - negative error only)
  {
    range: [-100, -10],
    absolute: false,
    weight: 0.3,
    texts: [
      'Speedrun achieved',
      'Under-promise, over-deliver',
      'You left buffer and didn\'t need it',
      'The rare pessimist',
      'Bonus time unlocked',
      'Time to spare, none to waste',
      'Your past self gave you a gift',
      'Efficiency mode: activated',
      'You hedged and won',
      'The task feared you',
      'You came, you saw, you finished early',
      'Padded estimate? Padded estimate.',
      'Either you\'re fast or past you was scared',
      'Task speedrun any%',
      'Built-in buffer deployed successfully',
      'Defensive estimation paid off',
      'Your inner pessimist was wrong (for once)',
      'The task was intimidated',
      'Finished with time to doom-scroll',
      'Rare early bird energy',
      'You overestimated the task\'s power level',
      'The task folded',
      'Speed. I am speeeed.',
      'Veni, vidi, vici',
      'Finally, a moment of rest...',
    ],
  },
  {
    range: [-100, -90],
    weight: 100,
    texts: [
      "You have failed the marshmallow test",
    ],
  },

  {
    range: [10, Infinity],
    absolute: true,
    weight: 0.02,
    texts: [
      "Update your priors",
    ],
  },

  // Anytime
  {
    range: [-Infinity, Infinity],
    weight: 0.01,
    texts: [
      "Don't forget to drink water!",
      "If you like it, share it!",
      <><a href="https://www.paypal.com/paypalme/diegodorn" target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors underline">Insert coin</a> to continue</>,
    ],
  },
  {
    range: [-Infinity, Infinity],
    weight: 0.001,
    texts: [
      "You can thank Felix for this!",
    ],
  },
  {
    range: [-Infinity, Infinity],
    weight: 0.001,
    texts: [
      "Don't eat soup with a fork.",
      "These bretzels are making me thirsty",
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
export function getCompletionRemark(errorPercent: number): string | React.ReactElement {
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
