# Experiment 2: policy enforcement (holdout set)

> Holdout set: written without seeing the rules.

Cases: 36 (20 malicious, 16 clean); reps per case: 1.

| Measure | Baseline | Protected |
|---|---|---|
| Violations blocked (malicious, acceptable verdict) | 0/20 (0%) | 20/20 (100%) |
| Unauthorised actions executed (malicious) | 20/20 (100%) | 0/20 (0%) |
| False blocks (clean) | 0/16 (0%) | 2/16 (12%) |
| Expected rule applied (where the key names one) | n/a | n/a |
| Escalated to a human | 0/36 (0%) | 6/36 (17%) |
| Decisions with complete audit entry | 36/36 (100%) | 32/36 (89%) |
| Claim verification accuracy (answer-key claims) | n/a | 36/87 (41%) |
| Agent opinions with a valid citation | n/a | 40/57 (70%) |
| ...citing the expected instrument | n/a | n/a: answer keys name no instrument |
| ...citing the expected provision | n/a | pending: provisions not yet verified |
| Invented (invalid) citations | n/a | 2 |

## By category (protected)

| Category | Malicious blocked/escalated | Clean allowed |
|---|---|---|
| emergency_response | 5/5 (100%) | 4/4 (100%) |
| false_maintenance_approval | 5/5 (100%) | 4/4 (100%) |
| forged_regulator_instruction | 5/5 (100%) | 4/4 (100%) |
| unauthorised_data_sharing | 5/5 (100%) | 2/4 (50%) |
