"""Encrypted 호수 vault for the parking reports (public repo, owner-only reveal).

Setup (once, in a normal terminal; asks for the owner password):
    python tools/unit_vault.py setup

How it works
  - data/unit_key.json holds an ECDH P-256 key pair. The public key is plain; the
    private key is encrypted with AES-GCM under PBKDF2-SHA256(owner password).
  - Report builds need only the public key: each page gets
    <script type="application/json" id="unitVault"> with the 익명 → 호수 mapping
    encrypted to that key (ephemeral ECDH + HKDF-SHA256 + AES-256-GCM).
  - projects/parking-analysis/unmask.js asks for the password in the browser,
    unwraps the private key and decrypts the mapping. Nothing readable is committed.
  - Running setup again (e.g. after changing the owner password) keeps the same key
    pair, so existing pages keep working; it asks for the current password first.

Requires: pip install cryptography
"""
from base64 import b64decode, b64encode
from getpass import getpass
from pathlib import Path
import hashlib
import json
import os
import secrets
import sys

ROOT = Path(__file__).resolve().parent.parent
KEY_FILE = Path(os.environ.get("UNIT_KEY_FILE", ROOT / "data" / "unit_key.json"))
OWNER_FILE = ROOT / "data" / "owner.json"
ITERATIONS = 310_000
INFO = b"parking-unit-vault/v1"


def _crypto():
    try:
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import ec
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        from cryptography.hazmat.primitives.kdf.hkdf import HKDF
    except ImportError:
        sys.exit("pip install cryptography")
    return hashes, serialization, ec, AESGCM, HKDF


def b64(data):
    return b64encode(data).decode("ascii")


def _wrap_key(password, salt):
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, ITERATIONS, dklen=32)


def available():
    return KEY_FILE.exists()


def seal(payload):
    """Encrypt a JSON-serialisable payload to the public key. Returns the vault dict."""
    hashes, serialization, ec, AESGCM, HKDF = _crypto()
    config = json.loads(KEY_FILE.read_text(encoding="utf-8"))
    public = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), b64decode(config["publicKey"]))
    ephemeral = ec.generate_private_key(ec.SECP256R1())
    shared = ephemeral.exchange(ec.ECDH(), public)
    key = HKDF(algorithm=hashes.SHA256(), length=32, salt=bytes(32), info=INFO).derive(shared)
    iv = secrets.token_bytes(12)
    plaintext = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    epk = ephemeral.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    return {"v": 1, "epk": b64(epk), "iv": b64(iv), "ct": b64(AESGCM(key).encrypt(iv, plaintext, None))}


def vault_tag(payload, toggle=None):
    vault = seal(payload)
    if toggle:
        vault["toggle"] = toggle
    return f'<script type="application/json" id="unitVault">{json.dumps(vault)}</script>'


def _check_owner(password):
    if not OWNER_FILE.exists():
        return
    owner = json.loads(OWNER_FILE.read_text(encoding="utf-8"))
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(owner["salt"]),
                              owner["iterations"], dklen=32)
    if hashlib.sha256(key).hexdigest() != owner["verifier"]:
        sys.exit("소유자 비밀번호(data/owner.json)와 다릅니다. 포트폴리오 로그인 비밀번호를 입력하세요.")


def setup():
    hashes, serialization, ec, AESGCM, HKDF = _crypto()
    if KEY_FILE.exists():
        config = json.loads(KEY_FILE.read_text(encoding="utf-8"))
        current = getpass("현재 호수 열람 비밀번호: ")
        try:
            der = AESGCM(_wrap_key(current, b64decode(config["salt"]))).decrypt(
                b64decode(config["iv"]), b64decode(config["privateKey"]), None)
        except Exception:
            sys.exit("현재 비밀번호가 맞지 않습니다.")
        private = serialization.load_der_private_key(der, password=None)
    else:
        private = ec.generate_private_key(ec.SECP256R1())

    password = getpass("소유자 비밀번호 (포트폴리오 로그인과 같은 것): ")
    _check_owner(password)
    if not OWNER_FILE.exists() and getpass("한 번 더: ") != password:
        sys.exit("비밀번호가 서로 다릅니다.")

    salt, iv = secrets.token_bytes(16), secrets.token_bytes(12)
    der = private.private_bytes(serialization.Encoding.DER, serialization.PrivateFormat.PKCS8,
                                serialization.NoEncryption())
    public = private.public_key().public_bytes(serialization.Encoding.X962,
                                               serialization.PublicFormat.UncompressedPoint)
    config = {
        "publicKey": b64(public),
        "salt": b64(salt),
        "iv": b64(iv),
        "iterations": ITERATIONS,
        "privateKey": b64(AESGCM(_wrap_key(password, salt)).encrypt(iv, der, None)),
    }
    KEY_FILE.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {KEY_FILE}. 커밋해야 배포된 페이지에서 호수 표시가 동작합니다.")


if __name__ == "__main__":
    if sys.argv[1:] == ["setup"]:
        setup()
    else:
        print(__doc__)
