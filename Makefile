PY ?= python3

.PHONY: install test validate telemetry spike exp1 exp2 exp2-holdout tables key verify-audit kb-setup kb-ingest kb-check

install:            ## install core + dev + llm + kb deps
	$(PY) -m pip install -e ".[dev,llm,kb]"

test:               ## all unit tests (always offline, never calls a paid API)
	$(PY) -m pytest

validate:           ## policy scenarios vs answer keys
	$(PY) -m scenarios.validate

telemetry:          ## regenerate synthetic telemetry (deterministic)
	$(PY) -m eval.generate_telemetry

spike:              ## Step 0: HolmesGPT spike (needs .env)
	bash spike/run_spike.sh

exp1:               ## Experiment 1 (needs .env); add ARGS="--reps 1 --payloads C3 F4" to start small
	$(PY) -m eval.run_exp1 $(ARGS)

exp2:               ## Experiment 2 on the development set
	$(PY) -m eval.run_exp2 --set dev

exp2-holdout:       ## Experiment 2 on the blind holdout set (report this one)
	$(PY) -m eval.run_exp2 --set holdout

tables:             ## build results tables from runs
	$(PY) -m eval.tables

key:                ## generate an audit encryption key for .env
	$(PY) -c "from cryptography.fernet import Fernet;print(Fernet.generate_key().decode())"

verify-audit:       ## independent audit-chain check (Exp 2 dev log)
	$(PY) tools/verify_audit.py results/runs/audit_exp2_dev/audit.jsonl results/runs/audit_exp2_dev/anchors/anchors.txt

kb-setup:           ## add ITU reference code as a pinned submodule
	bash tools/setup_itu.sh

kb-ingest:          ## ingest kb/InputDocs with the ITU pipeline (needs Ollama + nomic-embed-text)
	$(PY) -m kb.ingest_uae --reset

kb-check:           ## retrieval check (target 8/10 in top 3)
	$(PY) -m kb.retrieval_check
