/**
 * Password handling seam.
 *
 * REQUIREMENT (for now): passwords are stored and compared as PLAIN TEXT, exactly like the original app.
 * Every place that writes or checks a password goes through these two functions, so switching to
 * hashing later (e.g. bcrypt/argon2) only means changing this file (+ a one-off migration of existing rows).
 * Passwords are never returned by the API (User.password is select:false and res.json strips `password`)
 * and must never be logged.
 */
export function preparePasswordForStorage(plain: string): string {
  return plain; // TODO(later): return await hash(plain)
}

export function passwordMatches(plainInput: string, stored: string): boolean {
  return stored === plainInput; // TODO(later): return await compare(plainInput, stored)
}
