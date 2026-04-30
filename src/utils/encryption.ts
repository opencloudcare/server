import {createCipheriv, createDecipheriv, randomBytes, scryptSync} from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV for GCM
const KEY_LENGTH = 32; // 256-bit key
const SALT_ROUNDS = 16384; // scrypt N parameter

function getMasterKey(): Buffer {
  const key = process.env.ENCRYPTION_MASTER_KEY;
  if (!key || key.length !== 64) {
    throw new Error("ENCRYPTION_MASTER_KEY must be a 64-character hex string (32 bytes)");
  }
  return Buffer.from(key, "hex");
}

// Derives a user-specific key by mixing master key + userId via scrypt
function deriveUserKey(userId: string): Buffer {
  const masterKey = process.env.ENCRYPTION_MASTER_KEY!;
  return scryptSync(userId, masterKey, KEY_LENGTH, { N: SALT_ROUNDS });
}

function encryptWithKey(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  /** Encode as base64 parts separated by "." for easy splitting
   * The output string has 3 parts separated by .:
   *   - iv — needed to decrypt (not secret)
   *   - authTag — proves the data wasn't tampered with
   *   - encrypted — the actual ciphertext
   */
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(".");
}

function decryptWithKey(ciphertext: string, key: Buffer): string {
  const parts = ciphertext.split(".");
  if (parts.length !== 3) throw new Error("Invalid ciphertext format");
  const [ivB64, authTagB64, encryptedB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const encrypted = Buffer.from(encryptedB64, "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

/**
 * Double-encrypts a string array for a specific user.
 *
 * Layer 1: AES-256-GCM with the server master key
 * Layer 2: AES-256-GCM with a key derived from master key + userId (unique per user)
 *
 * Returns a single encrypted string suitable for storing in the DB.
 */
export function encryptHiddenData(data: string[], userId: string): string {
  const masterKey = getMasterKey();
  const userKey = deriveUserKey(userId);

  const serialized = JSON.stringify(data);
  const layer1 = encryptWithKey(serialized, masterKey);
  return encryptWithKey(layer1, userKey);
}

/**
 * Decrypts a double-encrypted string back into the original string array.
 * userId must match the one used during encryption.
 */
export function decryptHiddenData(encryptedData: string, userId: string): string[] {
  const masterKey = getMasterKey();
  const userKey = deriveUserKey(userId);

  const layer1 = decryptWithKey(encryptedData, userKey);
  const serialized = decryptWithKey(layer1, masterKey);
  return JSON.parse(serialized) as string[];
}