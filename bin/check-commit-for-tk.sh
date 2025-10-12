#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/tk-check-helpers.sh"

# If branch tracks private remote, allow Tango Kilo markers
if is_private_branch; then
  exit 0
fi

# Otherwise, check staged files for Tango Kilo markers
STAGED_FILES=$(git diff --name-only --cached | filter_excluded_files)

for FILE in $STAGED_FILES
do
    if should_scan_file "$FILE" && has_tk_marker "$FILE"; then
        echo "ERROR: You have a T""K in $FILE, please remove it before committing"
        echo "Hint: T""K markers are only allowed on branches that track the private remote"
        exit 1
    fi
done
