/**
 * A ULID, minted locally.
 *
 * `docs/vault-format.md` is explicit that these are NOT Postgres uuids and the
 * two formats must not be assumed interchangeable — a future sync maps between
 * them deliberately, and code that quietly treats one as the other is how that
 * mapping silently stops existing.
 *
 * Crockford base32: no I, L, O or U, so an id read aloud or retyped from a file
 * the student opened in a text editor does not become a different id.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function encode(value: number, length: number): string {
  let out = ''
  let n = value
  for (let i = 0; i < length; i += 1) {
    out = ALPHABET[n % 32] + out
    n = Math.floor(n / 32)
  }
  return out
}

export function ulid(now: number = Date.now()): string {
  // 10 chars of millisecond timestamp, so ids sort chronologically in a file a
  // human is reading, then 16 of randomness.
  const time = encode(now, 10)

  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let random = ''
  for (const byte of bytes) random += ALPHABET[byte % 32]

  return time + random
}
