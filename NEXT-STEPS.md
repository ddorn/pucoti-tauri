# Next Steps for PKGBUILD Release

## Changes Made

1. **Fixed binary name** from `app` to `pucoti`
   - Updated `src-tauri/Cargo.toml` package name to `pucoti`
   - Added explicit `[[bin]]` section to ensure binary is named `pucoti`
   - Rebuilt the .deb package with correct binary name

2. **Simplified PKGBUILD**
   - Removed symlink creation (no longer needed)
   - Removed desktop file patching (Tauri now generates it correctly)
   - Package is now cleaner and simpler

## New .deb Package

Location: `src-tauri/target/release/bundle/deb/Pucoti_1.0.0_amd64.deb`
SHA256: `4768805ae153b7afa540a229bfbe6798907520c5d181811d06d5d628e3c36213`

## Required Actions

### 1. Create New GitHub Release

You need to upload the new .deb to GitHub:

```bash
# Option 1: Update existing release (if it's a pre-release)
gh release upload pucoti-v1.0.0 \
  src-tauri/target/release/bundle/deb/Pucoti_1.0.0_amd64.deb \
  --clobber

# Option 2: Create new version (e.g., v1.0.1)
# Update version in tauri.conf.json and package.json first, then:
npm run tauri build -- --bundles deb
gh release create pucoti-v1.0.1 \
  src-tauri/target/release/bundle/deb/Pucoti_1.0.0_amd64.deb \
  --title "Pucoti v1.0.1" \
  --notes "Fixed binary name from 'app' to 'pucoti'"
```

### 2. Update PKGBUILD Checksum

After uploading to GitHub, update the PKGBUILD:

```bash
# Edit PKGBUILD and replace:
sha256sums_x86_64=('SKIP')  # Update after uploading new release

# With:
sha256sums_x86_64=('4768805ae153b7afa540a229bfbe6798907520c5d181811d06d5d628e3c36213')
```

### 3. Test the PKGBUILD

```bash
cd /home/diego/prog/archive/2026/pucoti-tauri
makepkg --clean --force
```

### 4. Generate .SRCINFO

```bash
makepkg --printsrcinfo > .SRCINFO
```

### 5. Publish to AUR

```bash
# Clone your AUR repo (first time only)
git clone ssh://aur@aur.archlinux.org/pucoti-bin.git aur-pucoti-bin

# Copy files
cp PKGBUILD pucoti.install .SRCINFO aur-pucoti-bin/
cd aur-pucoti-bin

# Commit and push
git add PKGBUILD pucoti.install .SRCINFO
git commit -m "Initial release: pucoti-bin 1.0.0-1"
git push
```

## Files Ready for AUR

- ✅ PKGBUILD - Simplified, no workarounds needed
- ✅ pucoti.install - Post-install hooks
- ⏳ .SRCINFO - Needs regeneration after checksum update

## Binary Name Verification

The new .deb contains:
- Binary: `/usr/bin/pucoti` ✅
- Desktop Entry: `Exec=pucoti` ✅
- Icon: `Icon=pucoti` ✅
- WM Class: `StartupWMClass=pucoti` ✅

All references are now consistent!
