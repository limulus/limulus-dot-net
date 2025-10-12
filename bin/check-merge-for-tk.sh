#!/usr/bin/env bash

# Source shared helper functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/tk-check-helpers.sh"

# Write directly to stderr to ensure output is visible
print_err() {
  echo "$@" >&2
}

# This script checks if a merge introduced Tango Kilo markers to a public branch
# If so, it attempts to roll back the merge

# If branch tracks private remote, allow Tango Kilo markers
if is_private_branch; then
  exit 0
fi

# Otherwise, check if the merge introduced Tango Kilo markers
# The merge is complete, so we compare HEAD with HEAD@{1} (before merge)
CHANGED_FILES=$(git diff --name-only HEAD@{1} HEAD 2>/dev/null | filter_excluded_files)

TANGO_KILO_FOUND=false
for FILE in $CHANGED_FILES
do
    if should_scan_file "$FILE" && has_tk_marker "$FILE"; then
        print_err "ERROR: Merge introduced T""K in $FILE"
        TANGO_KILO_FOUND=true
    fi
done

if [ "$TANGO_KILO_FOUND" = true ]; then
    print_err ""
    print_err "ERROR: Merge introduced T""K markers to a public branch!"
    print_err "Hint: T""K markers are only allowed on branches that track the private remote"
    print_err ""
    print_err "Attempting to roll back merge..."

    if git reset --merge HEAD@{1} 2>/dev/null; then
        print_err "Merge rolled back successfully"
    else
        print_err "Could not automatically roll back (uncommitted changes conflict)"
        print_err "Please manually undo the merge with one of:"
        print_err "  git reset --merge HEAD@{1}   # Try to preserve uncommitted changes"
        print_err "  git reset --hard HEAD@{1}    # Discard all uncommitted changes"
    fi

    exit 1
fi
