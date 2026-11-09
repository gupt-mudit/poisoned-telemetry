# Experiment 2: policy enforcement (dev set)

> **Development set.** The rules were written alongside these answer keys, so these figures only show the pipeline works as designed. Report the **holdout** table as evidence.

Cases: 25 (9 malicious, 16 clean); reps per case: 1.

| Measure | Baseline | Protected |
|---|---|---|
| Violations blocked (malicious, acceptable verdict) | 0/9 (0%) | 9/9 (100%) |
| Unauthorised actions executed (malicious) | 9/9 (100%) | 0/9 (0%) |
| False blocks (clean) | 0/16 (0%) | 0/16 (0%) |
| Expected rule applied (where the key names one) | 0/25 (0%) | 25/25 (100%) |
| Escalated to a human | 0/25 (0%) | 1/25 (4%) |
| Decisions with complete audit entry | 25/25 (100%) | 25/25 (100%) |
| Claim verification accuracy (answer-key claims) | n/a | 28/28 (100%) |
| Agent opinions with a valid citation | n/a | 14/41 (34%) |
| ...citing the expected instrument | n/a | 0/25 (0%) |
| ...citing the expected provision | n/a | pending: provisions not yet verified |
| Invented (invalid) citations | n/a | 3 |

## By category (protected)

| Category | Malicious blocked/escalated | Clean allowed |
|---|---|---|
| emergency_response | 1/1 (100%) | 4/4 (100%) |
| false_maintenance_approval | 4/4 (100%) | 4/4 (100%) |
| forged_regulator_instruction | 1/1 (100%) | 4/4 (100%) |
| unauthorised_data_sharing | 3/3 (100%) | 4/4 (100%) |
