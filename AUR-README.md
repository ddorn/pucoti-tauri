# Pucoti AUR Package

This directory contains the PKGBUILD for publishing Pucoti to the Arch User Repository (AUR).

## Files

- **PKGBUILD** - Main package build script
- **pucoti.install** - Post-installation hooks for desktop database and icon cache
- **.SRCINFO** - AUR metadata (auto-generated, must be kept in sync)

## Package Details

- **Package name**: `pucoti-bin` (binary package from GitHub releases)
- **Architecture**: x86_64 only (no arm64 .deb available in releases)
- **Binary name**: The package installs `pucoti` command (symlink to `app`)
- **Desktop file**: Updated to launch with `pucoti` command

## Testing Locally

```bash
# Build the package
makepkg --clean

# Install (requires sudo)
sudo pacman -U pucoti-bin-1.0.0-1-x86_64.pkg.tar.zst

# Test the installation
pucoti

# Uninstall
sudo pacman -R pucoti-bin
```

## Publishing to AUR

### Prerequisites

1. Create an AUR account at https://aur.archlinux.org
2. Configure SSH keys for AUR access
3. Clone the empty AUR repository:
   ```bash
   git clone ssh://aur@aur.archlinux.org/pucoti-bin.git aur-pucoti-bin
   ```

### Publishing Steps

1. Copy files to AUR repository:
   ```bash
   cp PKGBUILD pucoti.install .SRCINFO ../aur-pucoti-bin/
   cd ../aur-pucoti-bin
   ```

2. Review changes:
   ```bash
   git status
   git diff
   ```

3. Commit and push:
   ```bash
   git add PKGBUILD pucoti.install .SRCINFO
   git commit -m "Initial release: pucoti-bin 1.0.0-1"
   git push
   ```

### Updating for New Releases

When publishing a new version:

1. Update `pkgver` in PKGBUILD (and potentially `pkgrel`)
2. Update the GitHub release tag in the source URL if it changes
3. Download the new .deb and update the sha256sum:
   ```bash
   makepkg --geninteg
   ```
   Replace the `sha256sums_x86_64` line with the output
4. Regenerate .SRCINFO:
   ```bash
   makepkg --printsrcinfo > .SRCINFO
   ```
5. Test build:
   ```bash
   makepkg --clean
   ```
6. Commit and push to AUR

## Notes

- The package downloads the .deb from GitHub releases (tag: `pucoti-v{pkgver}`)
- Desktop file is patched to use `pucoti` command instead of `app`
- License is set to 'unknown' - update this once determined
- Maintainer info in PKGBUILD should be updated before publishing

## Future Improvements

Consider renaming the actual binary from `app` to `pucoti` in future releases to avoid the need for symlinks and desktop file patching.
