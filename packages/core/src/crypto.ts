import type { EncryptedPayload } from "./types.js";

function getSubtleCrypto(): SubtleCrypto {
  if (typeof globalThis.crypto !== "undefined") return globalThis.crypto.subtle;
  throw new Error("Web Crypto API is not available in this environment");
}

async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const enc = new TextEncoder();
  const keyMaterial = await subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey(
    { name: "PBKDF2", salt: salt.buffer as ArrayBuffer, iterations: 310_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encrypt(plaintext: string, password: string): Promise<EncryptedPayload> {
  const subtle = getSubtleCrypto();
  const enc = new TextEncoder();
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKeyFromPassword(password, salt);
  const ciphertext = await subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext));

  return {
    ciphertext: bufToHex(new Uint8Array(ciphertext)),
    iv: bufToHex(iv),
    salt: bufToHex(salt),
  };
}

export async function decrypt(payload: EncryptedPayload, password: string): Promise<string> {
  const subtle = getSubtleCrypto();
  const dec = new TextDecoder();
  const salt = hexToBuf(payload.salt);
  const iv = hexToBuf(payload.iv);
  const ciphertext = hexToBuf(payload.ciphertext);
  const key = await deriveKeyFromPassword(password, salt);
  const plaintext = await subtle.decrypt({ name: "AES-GCM", iv: iv.buffer as ArrayBuffer }, key, ciphertext.buffer as ArrayBuffer);
  return dec.decode(plaintext);
}

function bufToHex(buf: Uint8Array): string {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuf(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return arr;
}
