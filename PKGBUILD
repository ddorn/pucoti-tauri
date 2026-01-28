# Maintainer: Your Name <your.email@example.com>
pkgname=pucoti-bin
pkgver=1.0.0
pkgrel=1
pkgdesc="Desktop timer application for tracking predicted vs actual task durations"
arch=('x86_64')
url="https://github.com/ddorn/pucoti-tauri"
license=('unknown')
depends=('cairo' 'desktop-file-utils' 'gdk-pixbuf2' 'glib2' 'gtk3' 'hicolor-icon-theme' 'libsoup' 'pango' 'webkit2gtk-4.1')
provides=('pucoti')
conflicts=('pucoti')
install=pucoti.install

source_x86_64=("${pkgname}-${pkgver}.deb::${url}/releases/download/pucoti-v${pkgver}/Pucoti_${pkgver}_amd64.deb")

sha256sums_x86_64=('SKIP')  # Update after uploading new release

package() {
    # Extract data from the .deb package
    bsdtar -xf data.tar.gz -C "${pkgdir}"

    # Ensure proper permissions
    chmod 755 "${pkgdir}/usr/bin/pucoti"
}
