# Build and install Pucoti from source.
#
#   make install                        -> ~/.local (no root needed)
#   sudo make install PREFIX=/usr/local
#   make uninstall
#
# Nothing is substituted into the installed files, so PREFIX also works as a
# staging root for packaging.

PREFIX ?= $(HOME)/.local

BINDIR  = $(PREFIX)/bin
APPDIR  = $(PREFIX)/share/applications
ICONDIR = $(PREFIX)/share/icons/hicolor

BIN = src-tauri/target/release/pucoti

.PHONY: build install uninstall

build:
	npm run tauri:build

$(BIN):
	$(MAKE) build

install: $(BIN)
	install -Dm755 $(BIN) $(BINDIR)/pucoti
	install -Dm644 src-tauri/icons/32x32.png      $(ICONDIR)/32x32/apps/pucoti.png
	install -Dm644 src-tauri/icons/128x128.png    $(ICONDIR)/128x128/apps/pucoti.png
	install -Dm644 src-tauri/icons/128x128@2x.png $(ICONDIR)/256x256/apps/pucoti.png
	install -Dm644 src-tauri/icons/icon.png       $(ICONDIR)/512x512/apps/pucoti.png
# Same basename as the .deb/.rpm entry, so a source install over a package
# install overrides it instead of adding a second menu entry.
	install -Dm644 packaging/Pucoti.desktop $(APPDIR)/Pucoti.desktop
	-@update-desktop-database $(APPDIR) 2>/dev/null
# The icon cache is only a lookup optimisation - icons resolve by directory scan
# without it - and gtk-update-icon-cache fails on unrelated icons some users
# already have, so its failure is not worth reporting.
	-@gtk-update-icon-cache -q -f -t $(ICONDIR) 2>/dev/null
	@echo "Installed to $(BINDIR)/pucoti"

uninstall:
	rm -f $(BINDIR)/pucoti
	rm -f $(APPDIR)/Pucoti.desktop
	rm -f $(ICONDIR)/32x32/apps/pucoti.png
	rm -f $(ICONDIR)/128x128/apps/pucoti.png
	rm -f $(ICONDIR)/256x256/apps/pucoti.png
	rm -f $(ICONDIR)/512x512/apps/pucoti.png
	-@update-desktop-database $(APPDIR) 2>/dev/null
	-@gtk-update-icon-cache -q -f -t $(ICONDIR) 2>/dev/null
