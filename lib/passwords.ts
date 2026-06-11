import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const keyLength = 64;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, keyLength).toString("hex");

  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string | null) {
  if (!storedHash) {
    return false;
  }

  const [algorithm, salt, hash] = storedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !hash) {
    return false;
  }

  const candidate = scryptSync(password, salt, keyLength);
  const original = Buffer.from(hash, "hex");

  return original.length === candidate.length && timingSafeEqual(original, candidate);
}

export function isStrongEnoughPassword(password: string) {
  return password.length >= 8;
}
