# Pucoti

Stay on task with PUCOTI, a countdown timer built for simplicity, purpose, and overcoming the planning fallacy.

![New Focus Screen](docs/screenshots/new-focus.png)

## Why Pucoti?

Most of us are terrible at estimating how long tasks will take. Pucoti helps you build calibration by tracking your predictions against reality. It also keeps you focused on a single task by displaying your goal in the corner of the screen at all times—no forgetting what you're supposed to be doing.

## Features

![Timer Screen](docs/screenshots/timer.png)

### Timer Features
- **No Pause**: Time always moves forward. Just like reality.
- **Countdown with Overtime**: Counts down to zero and keeps going below.
- **Bell Alert**: Rings when you hit zero, then every 20 seconds until acknowledged.
- **Always Visible Goal**: Your task stays in a corner of the screen to keep you focused.

### Calibration & Learning
- **Predictions**: Record how long you think each task will take.
- **Statistics**: See your estimation accuracy and learn to calibrate over time.
- **Export**: Export sessions as CSV for deeper analysis.

### Privacy & Customization
- **Local Storage**: Everything stored locally. No network access.
- **Configurable**: Change bell sounds, colors, window sizes, and more.

![Stats Screen](docs/screenshots/stats.png)
![Small Mode](docs/screenshots/small-mode.png)

## Installation

Built with Tauri for Linux, macOS, and Windows.

**Build from source** (requires Node.js 18+ and Rust 1.77.2+):

```bash
npm install && npm run tauri:build
```

Then copy the executable in `src-tauri/target/release/` to your desktop.

Official releases and installers are coming soon.

## Alternatives

PUCOTI is great, but there might be other tools that are better for you. The best alternatives in this space are:
- **[Fatebook](https://fatebook.io/)**: Make and track predictions about anything.
- Multiple task trackers offer similar features (always on top, tracking) but little calibration tools: **[Amazing Marvin](https://amazingmarvin.com/)**, **[Superproductivity](https://super-productivity.com)**

Open an issue if you know others!

## License
MIT