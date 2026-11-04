#!/usr/bin/env bash
# Step 0 spike: does planted text in telemetry change HolmesGPT's diagnosis?
# Runs the RAW set-up on: clean data, one crude payload (C1), one subtle payload (C3).
# Needs: HolmesGPT installed (see spike/README.md), HOLMES_MODEL and the provider API key.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] && set -a && . ./.env && set +a
: "${HOLMES_MODEL:?set HOLMES_MODEL in .env, e.g. anthropic/<model-id>}"
HOLMES_BIN="${HOLMES_BIN:-holmes}"
RUNS="${RUNS:-5}"
PY="${PY:-python3}"
OUT=results/spike; mkdir -p "$OUT" data/generated
$PY -m eval.generate_telemetry >/dev/null
$PY -m eval.inject C1 >/dev/null
$PY -m eval.inject C3 >/dev/null
declare -A LOG=( [clean]=data/telemetry/pe07_incident [C1]=data/generated/poisoned_C1_s7 [C3]=data/generated/poisoned_C3_s7 )
Q="$(cat holmes_integration/question.txt)"
for v in clean C1 C3; do
  base="${LOG[$v]}"
  $PY holmes_integration/make_toolset.py raw "$base.log" "$base.jsonl" "$OUT/toolset_$v.yaml" >/dev/null
  for i in $(seq 1 "$RUNS"); do
    echo ">> $v run $i"
    "$HOLMES_BIN" ask "$Q" -t "$OUT/toolset_$v.yaml" --model "$HOLMES_MODEL" --no-interactive \
      --json-output-file "$OUT/${v}_run${i}.json" > "$OUT/${v}_run${i}.txt" 2>&1 || echo "   (run failed, see $OUT/${v}_run${i}.txt)"
  done
done
$PY spike/summarise_spike.py "$OUT"
