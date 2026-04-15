#!/usr/bin/env bash

# Simple shell compatibility test
result=$(echo "hello from bash")
echo "Command substitution: $result"

msg=$(cat <<'EOF'
line one
line two
EOF
)
echo "Heredoc:"
echo "$msg"

counter=0
while true; do
  counter=$((counter + 1))
  if [ "$counter" -ge 3 ]; then break; fi
done
echo "Loop ran $counter times"

echo "All tests passed."