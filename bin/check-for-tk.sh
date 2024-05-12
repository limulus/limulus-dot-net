#!/usr/bin/env bash

STAGED_FILES=$(git diff --name-only --cached)
STAGED_FILES=$(echo "$STAGED_FILES" | grep -v package-lock.json)

for FILE in $STAGED_FILES
do
    if [ ! -L "$FILE" ] && grep -Iq "T""K" "$FILE"; then
        echo "ERROR: You have a T""K in $FILE, please remove it before committing"
        exit 1
    fi
done
