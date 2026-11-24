#!/bin/bash
# ensure-dev.sh — make sure the OpenStore dev server is up (restart if down).
# Usage: bash scripts/ensure-dev.sh [timeout_secs]
cd /home/z/my-project
T=${1:-60}
code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ --max-time 3)
if [ "$code" = "200" ]; then
  echo "server already up"
  exit 0
fi
echo "starting dev server..."
(bun run dev > /dev/null 2>&1 &)
for i in $(seq 1 $((T / 2))); do
  sleep 2
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ --max-time 5)
  if [ "$code" = "200" ]; then
    echo "server up"
    exit 0
  fi
done
echo "server failed to start"
exit 1
