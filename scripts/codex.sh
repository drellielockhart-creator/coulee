#!/usr/bin/env bash
# Run a Codex (OpenAI) agent non-interactively in this repo, pinned to a current GPT-6.x model.
#
#   scripts/codex.sh <job-name> <prompt-file> [model] [effort] [sandbox] [output-schema.json]
#
# model:   gpt-6.1-sol (default; workhorse) | gpt-6-astra (frontier) | gpt-6-luna (fast/mechanical)
# effort:  low | medium | high (default) | xhigh | max
# sandbox: workspace-write (default) | read-only
#
# Logs go to runs/codex/<job-name>/ (gitignored): prompt.md, events.jsonl, stderr.log, last.md (final message).
# Ellie's rule: use GPT-6 / 6.1 models only, never the 5.x generation.
set -euo pipefail

name=${1:?job name}
promptfile=${2:?prompt file}
model=${3:-gpt-6.1-sol}
effort=${4:-high}
sandbox=${5:-workspace-write}
schema=${6:-}

case "$model" in
  gpt-6*) ;;
  *) echo "codex.sh: refusing model '$model' (GPT-6.x only)" >&2; exit 2 ;;
esac

root=$(cd "$(dirname "$0")/.." && pwd)
out="$root/runs/codex/$name"
mkdir -p "$out"
cp "$promptfile" "$out/prompt.md"

args=(exec -m "$model" -c "model_reasoning_effort=\"$effort\"" -s "$sandbox" -C "$root" --json -o "$out/last.md")
if [[ -n "$schema" ]]; then args+=(--output-schema "$schema"); fi

set +e
codex "${args[@]}" - <"$promptfile" >"$out/events.jsonl" 2>"$out/stderr.log"
rc=$?
set -e
echo "codex job '$name' ($model/$effort/$sandbox) exited $rc; final message: $out/last.md"
exit $rc
