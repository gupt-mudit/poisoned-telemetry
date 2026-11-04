# Mapping to ITU-T Y.3172 (architectural framework for ML in future networks)

This is a proposed design mapping, not a certification.

| Y.3172 element | Role in the framework | In Poisoned Telemetry | Code |
|---|---|---|---|
| SRC (source) | Where data originates | Devices, alarms, syslog and tickets (synthetic) | `eval/generate_telemetry.py` |
| C (collector) | Gathers data from sources | Telemetry items with channel, source and trust label | `trustlayer/models.py` (`TelemetryItem`) |
| PP (preprocessor) | Prepares data for the model | **Trust layer**: detector, quarantine reader, claim extraction and verification | `trustlayer/detector.py`, `quarantine.py`, `claims.py`, `verify_claims.py` |
| M (model) | ML/AI model | HolmesGPT investigation agent; institutional agents | `holmes_integration/`, `agents/institutional.py` |
| P (policy) | Applies policy to model outputs | **Rule-checker** with cited rules | `trustlayer/rulechecker.py`, `trustlayer/rules.yaml` |
| D (distributor) | Delivers outputs to sinks | Decision with the five fields; audit entry | `scenarios/run.py` |
| SINK | Where outputs take effect | Operator, regulator, cyber authority, data office (simulated) | `data/records/mandates.csv` |
| MLFO (ML function orchestrator) | Orchestrates the pipeline | Scenario controller with timed event release | `scenarios/run.py` |
| ML sandbox | Safe environment for evaluation | Synthetic data, no live network, red-team payloads | `eval/`, `data/payloads.yaml` |
| Data/knowledge repository | Supporting data | UAE + comparator knowledge base, built with ITU reference code | `kb/` |

Key alignment point: Y.3172 places preprocessing before the model. We use that stage as the
security boundary — untrusted text is screened and verified **before** any agent that can act
receives it — and we place policy (P) after the model, so no model output reaches a sink
without a deterministic, cited check.
