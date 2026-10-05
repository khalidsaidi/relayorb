#!/bin/sh
# RelayOrb installer: curl -fsSL https://relayorb.com/install.sh | sh
#
# Environment:
#   RELAYORB_INSTALL_DIR  where to put the binary (default: ~/.local/bin)
#   RELAYORB_VERSION      release tag to install, e.g. v0.2.0 (default: latest)
set -eu

REPO="khalidsaidi/relayorb"
INSTALL_DIR="${RELAYORB_INSTALL_DIR:-$HOME/.local/bin}"
VERSION="${RELAYORB_VERSION:-latest}"

say() { printf 'relayorb: %s\n' "$*"; }
die() { printf 'relayorb: error: %s\n' "$*" >&2; exit 1; }

need() { command -v "$1" > /dev/null 2>&1 || die "'$1' is required"; }
need uname
need tar
if command -v curl > /dev/null 2>&1; then
  fetch() { curl -fsSL "$1" -o "$2"; }
elif command -v wget > /dev/null 2>&1; then
  fetch() { wget -qO "$2" "$1"; }
else
  die "curl or wget is required"
fi

os="$(uname -s)"
arch="$(uname -m)"
case "$os" in
  Linux) os_part="unknown-linux-gnu" ;;
  Darwin) os_part="apple-darwin" ;;
  MINGW* | MSYS* | CYGWIN*) die "on Windows, download relayorb-x86_64-pc-windows-msvc.zip from https://github.com/$REPO/releases" ;;
  *) die "unsupported OS: $os" ;;
esac
case "$arch" in
  x86_64 | amd64) arch_part="x86_64" ;;
  arm64 | aarch64) arch_part="aarch64" ;;
  *) die "unsupported CPU: $arch" ;;
esac
target="$arch_part-$os_part"
asset="relayorb-$target.tar.gz"

if [ "$VERSION" = "latest" ]; then
  base="https://github.com/$REPO/releases/latest/download"
else
  base="https://github.com/$REPO/releases/download/$VERSION"
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT INT TERM

say "downloading $asset ($VERSION)"
fetch "$base/$asset" "$tmp/$asset" || die "download failed: $base/$asset"

if fetch "$base/$asset.sha256" "$tmp/$asset.sha256" 2> /dev/null; then
  expected="$(cut -d ' ' -f 1 < "$tmp/$asset.sha256")"
  if command -v sha256sum > /dev/null 2>&1; then
    actual="$(sha256sum "$tmp/$asset" | cut -d ' ' -f 1)"
  elif command -v shasum > /dev/null 2>&1; then
    actual="$(shasum -a 256 "$tmp/$asset" | cut -d ' ' -f 1)"
  else
    actual="$expected"
    say "no sha256 tool found; skipping checksum verification"
  fi
  [ "$expected" = "$actual" ] || die "checksum mismatch for $asset"
fi

tar -xzf "$tmp/$asset" -C "$tmp"
mkdir -p "$INSTALL_DIR"
mv "$tmp/relayorb-$target/relayorb" "$INSTALL_DIR/relayorb"
chmod +x "$INSTALL_DIR/relayorb"

say "installed $("$INSTALL_DIR/relayorb" --version) to $INSTALL_DIR/relayorb"
case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *) say "add $INSTALL_DIR to your PATH, e.g.: export PATH=\"$INSTALL_DIR:\$PATH\"" ;;
esac
