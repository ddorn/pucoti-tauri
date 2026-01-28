# Pucoti

Stay on task with PUCOTI, a countdown timer built for simplicity, purpose, and overcoming the planning fallacy.

<div align="center">
  <img src="docs/screenshots/new-focus.webp" alt="New Focus Screen" width="600">
</div>

## Why Pucoti?

Most of us are terrible at estimating how long tasks will take. Pucoti helps you build calibration by tracking your predictions against reality. It also keeps you focused on a single task by displaying your goal in the corner of the screen at all times—no forgetting what you're supposed to be doing.

## Features

<div align="center">
  <img src="docs/screenshots/timer.webp" alt="Timer Screen" width="600">
</div>

### Timer Features
- **No Pause**: Time always moves forward. Just like reality.
- **Countdown with Overtime**: Counts down to zero and keeps going below.
- **Bell Alert**: Rings when you hit zero, then every 20 seconds until acknowledged.
- **Always Visible Goal**: Your task stays in a corner of the screen to keep you focused.

![Small Mode](docs/screenshots/small-mode.webp)

### Calibration & Learning
- **Predictions**: Record how long you think each task will take.
- **Statistics**: See your estimation accuracy and learn to calibrate over time.
- **Export**: Export sessions as CSV for deeper analysis.

![Stats Screen](docs/screenshots/stats.webp)

### Privacy & Customization
- **Local Storage**: Everything stored locally. No network access.
- **Configurable**: Change bell sounds, colors, window sizes, and more.

### GNOME Panel Indicator (Linux)

![GNOME Panel Indicator](docs/screenshots/gnome-extension.webp)
On GNOME, Pucoti can show timer status in the top panel. The extension is included with deb/rpm packages. After installing, log out and back in, then enable it in Settings → "Minimize window" on timer start.

## Installation

Download the latest release from [GitHub Releases](https://github.com/ddorn/pucoti-tauri/releases).

### Linux

**Debian/Ubuntu (.deb)**:
```bash
sudo apt install ./Pucoti_*_amd64.deb
```

**Fedora/RHEL/openSUSE (.rpm)**:
```bash
sudo rpm -i Pucoti-*.x86_64.rpm
```

### Windows

Download and run `Pucoti_*_x64_en-US.msi`. Follow the installation wizard.

### macOS

1. Download the appropriate file for your Mac:
   - **Apple Silicon (M1/M2/M3)**: `Pucoti_aarch64.app.tar.gz`
   - **Intel**: `Pucoti_x64.app.tar.gz`

2. Extract the archive:
```bash
tar -xzf Pucoti_*.app.tar.gz
```

3. Move `Pucoti.app` to your Applications folder:
```bash
mv Pucoti.app /Applications/
```

4. **First launch**: macOS will block the app since it's not signed. Right-click the app, select "Open", then click "Open" in the dialog to bypass Gatekeeper.

### Build from Source

Requires Node.js 18+ and Rust 1.77.2+:

```bash
npm install && npm run tauri:build
```

The executable will be in `src-tauri/target/release/`.

**GNOME extension (manual install):**
```bash
./gnome-extension/install.sh
# Log out and back in, then:
gnome-extensions enable pucoti@pucoti.dev
```

## Alternatives

PUCOTI is great, but there might be other tools that are better for you. The best alternatives in this space are:
- **[Fatebook](https://fatebook.io/)**: Make and track predictions about anything.
- Multiple task trackers offer similar features (always on top, tracking) but little calibration tools: **[Amazing Marvin](https://amazingmarvin.com/)**, **[Superproductivity](https://super-productivity.com)**

Open an issue if you know others!

## License

MIT
