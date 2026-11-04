# Holdout scenarios — written BLIND

These are the cases you report as evidence. Rules for writing them:

1. The author must NOT read `trustlayer/rules.yaml`, `trustlayer/rulechecker.py` or the
   claim-extraction code first. Person A or D writes them; Person C (who built the rules) does not.
2. Start from `TEMPLATE.yaml.example` (not from `scenarios/policy/`: those files name the rules).
   Full brief: `docs/HOLDOUT_BRIEF.md`. Write the answer key from policy and common sense, BEFORE running anything.
3. Target: about 20 malicious + 16 clean, across the four categories, with new wording,
   new nodes, new change IDs (add genuine ones to data/records/changes.csv), other agents.
4. Run: `python -m eval.run_exp2 --set holdout && python -m eval.tables`.
5. Do NOT edit the rules to fix holdout failures and then re-report the same set. If you
   change the rules, say so, and write a fresh holdout batch. Report failures honestly.
