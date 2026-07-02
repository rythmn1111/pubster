import argon2 from 'argon2';

/**
 * Password hashing wrappers (argon2id) — see docs/BACKEND.md §Auth design.
 * Used for staff/manager/super-admin email+password logins.
 */
const HASH_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
};

export function hashPassword(plaintext: string): Promise<string> {
  return argon2.hash(plaintext, HASH_OPTIONS);
}

export function verifyPassword(hash: string, plaintext: string): Promise<boolean> {
  return argon2.verify(hash, plaintext);
}
