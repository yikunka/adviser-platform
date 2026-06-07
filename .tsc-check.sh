#!/bin/bash
cd "$(dirname "$0")"
npx tsc --noEmit > .tsc-output.txt 2>&1
echo "EXIT:$?" >> .tsc-output.txt
