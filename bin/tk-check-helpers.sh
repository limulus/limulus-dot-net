#!/usr/bin/env bash

# Shared helper functions for Tango Kilo marker checking

# Check if current branch tracks the private remote
# Returns 0 if it does (allowing Tango Kilo markers), 1 if it doesn't
is_private_branch() {
  UPSTREAM=$(git rev-parse --abbrev-ref @{upstream} 2>/dev/null || true)
  [[ "$UPSTREAM" == private/* ]]
}

# Filter out files we never want to check for Tango Kilo markers
# Reads from stdin, writes to stdout
filter_excluded_files() {
  grep -v -e package-lock.json -e photos.json -e CLAUDE.md -e snapshots/
}

# Check if a file should be scanned for Tango Kilo markers
# Returns 0 if it should be scanned, 1 if it should be skipped
should_scan_file() {
  local FILE="$1"
  # Skip symlinks and non-files
  [ -f "$FILE" ] && [ ! -L "$FILE" ]
}

# Check if a file contains Tango Kilo markers
# Returns 0 if Tango Kilo found, 1 if not found
has_tk_marker() {
  local FILE="$1"
  grep -Iq "T""K" "$FILE"
}
