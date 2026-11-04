#!/usr/bin/env python3
"""Independent audit-chain verifier. Deliberately imports NOTHING from this project, so a
reviewer can check integrity without trusting our code.

usage: python tools/verify_audit.py audit/audit.jsonl [audit/anchors/anchors.txt]
exit 0 = chain intact (and every anchor found in the chain); exit 1 = tampering detected
"""
import hashlib, json, sys

def canonical(o):
    return json.dumps(o, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)

def main(path, anchors=None):
    prev, hashes, ok = "0" * 64, set(), True
    for n, line in enumerate(open(path), 1):
        if not line.strip():
            continue
        e = json.loads(line)
        claimed = e.pop("hash")
        if e.get("prev") != prev:
            print(f"BROKEN at entry {n}: prev link does not match"); ok = False
        if hashlib.sha256(canonical(e).encode()).hexdigest() != claimed:
            print(f"BROKEN at entry {n}: content does not match its hash"); ok = False
        prev = claimed; hashes.add(claimed)
    if anchors:
        for line in open(anchors):
            h = line.split()[-1]
            if h not in hashes:
                print(f"ANCHOR MISMATCH: anchored hash {h[:12]}... not in chain"); ok = False
    print("CHAIN INTACT" if ok else "TAMPERING DETECTED")
    return 0 if ok else 1

if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None))
