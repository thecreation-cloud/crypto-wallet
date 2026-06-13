import { generateMnemonic as _generateMnemonic, mnemonicToSeedSync, validateMnemonic as _validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { HDKey } from "@scure/bip32";
import { hmac } from "@noble/hashes/hmac";
import { sha512 } from "@noble/hashes/sha512";
import { ed25519 } from "@noble/curves/ed25519";
import type { DerivationResult } from "./types.js";

export function generateMnemonic(strength: 128 | 256 = 128): string {
  return _generateMnemonic(wordlist, strength);
}

export function validateMnemonic(mnemonic: string): boolean {
  return _validateMnemonic(mnemonic, wordlist);
}

export function mnemonicToSeed(mnemonic: string, passphrase?: string): Uint8Array {
  return mnemonicToSeedSync(mnemonic, passphrase);
}

export function deriveKey(seed: Uint8Array, path: string): DerivationResult {
  const root = HDKey.fromMasterSeed(seed);
  const child = root.derive(path);

  if (!child.privateKey) throw new Error(`Cannot derive private key at path ${path}`);
  if (!child.publicKey) throw new Error(`Cannot derive public key at path ${path}`);

  return {
    privateKey: child.privateKey,
    publicKey: child.publicKey,
    path,
  };
}

export function deriveAccountKey(
  seed: Uint8Array,
  coinType: number,
  accountIndex = 0,
  change = 0,
  addressIndex = 0,
): DerivationResult {
  const path = `m/44'/${coinType}'/${accountIndex}'/${change}/${addressIndex}`;
  return deriveKey(seed, path);
}

export function deriveEd25519Key(seed: Uint8Array, path: string): DerivationResult {
  const segments = path
    .replace(/^m\/?/, "")
    .split("/")
    .filter(Boolean)
    .map((s) => {
      const hardened = s.endsWith("'");
      const idx = parseInt(s.replace("'", ""), 10);
      if (!hardened) throw new Error("ed25519 SLIP-0010 requires all path segments to be hardened");
      return (idx + 0x80000000) >>> 0;
    });

  const masterI = hmac(sha512, new TextEncoder().encode("ed25519 seed"), seed);
  let kL = masterI.slice(0, 32);
  let kR = masterI.slice(32);

  for (const index of segments) {
    const buf = new Uint8Array(37);
    buf[0] = 0x00;
    buf.set(kL, 1);
    buf[33] = (index >>> 24) & 0xff;
    buf[34] = (index >>> 16) & 0xff;
    buf[35] = (index >>> 8) & 0xff;
    buf[36] = index & 0xff;
    const childI = hmac(sha512, kR, buf);
    kL = childI.slice(0, 32);
    kR = childI.slice(32);
  }

  const publicKey = ed25519.getPublicKey(kL);
  return { privateKey: kL, publicKey, path };
}
