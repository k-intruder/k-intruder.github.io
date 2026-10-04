"""Create or replace data/owner.json for the portfolio owner login.

Usage (from the repository root):
    python tools/set_owner_password.py

The password itself is never stored. owner.json keeps only a random salt,
the PBKDF2 iteration count and SHA-256(PBKDF2(password)), which assets/auth.js
recomputes in the browser.
"""
from getpass import getpass
from pathlib import Path
import hashlib
import json
import secrets
import sys

ITERATIONS = 310_000
MIN_LENGTH = 12
OUTPUT = Path(__file__).resolve().parent.parent / "data" / "owner.json"


def main():
    password = getpass("Owner password: ")
    if len(password) < MIN_LENGTH:
        sys.exit(f"Password must be at least {MIN_LENGTH} characters.")
    if getpass("Confirm password: ") != password:
        sys.exit("Passwords do not match.")

    salt = secrets.token_bytes(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, ITERATIONS, dklen=32)
    config = {
        "salt": salt.hex(),
        "iterations": ITERATIONS,
        "verifier": hashlib.sha256(key).hexdigest(),
    }

    OUTPUT.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT}. Commit it to enable owner login.")


if __name__ == "__main__":
    main()
