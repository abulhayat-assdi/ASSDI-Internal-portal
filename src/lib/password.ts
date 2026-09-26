import "server-only";
import bcrypt from "bcryptjs";

/**
 * One place to decide how expensive a password hash is.
 *
 * bcrypt's cost is deliberately slow, and that cost is paid on the server's
 * CPU at every single login. On this deployment — two cores, shared with
 * several other apps — cost 12 measured at 331ms per verification, which caps
 * logins at about six per second. A centre where a whole class signs in at
 * 9am would queue for half a minute.
 *
 * Cost 10 measures around 83ms, so roughly four times the login throughput,
 * and remains bcrypt's own default and a widely accepted floor. Raise it again
 * (via BCRYPT_COST) on a host with CPU to spare.
 */
export const PASSWORD_COST: number = (() => {
    const raw = Number(process.env.BCRYPT_COST);
    // Refuse anything below 8: that stops a typo from silently weakening
    // every password in the database.
    return Number.isInteger(raw) && raw >= 8 && raw <= 15 ? raw : 10;
})();

/** Hashes a new or changed password at the configured cost. */
export function hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, PASSWORD_COST);
}

/** Verifies a password against a stored hash of any cost. */
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
}

/**
 * True when a stored hash was made at a different cost than the one now
 * configured.
 *
 * Existing hashes keep whatever cost they were created with, so lowering
 * PASSWORD_COST does nothing for accounts that already exist — they stay slow
 * until the password is changed. Callers use this to re-hash opportunistically
 * on a successful login, where the plaintext is in hand anyway, so the fleet
 * converges on the configured cost without anyone having to reset anything.
 */
export function needsRehash(hash: string): boolean {
    let rounds: number;
    try {
        rounds = bcrypt.getRounds(hash);
    } catch {
        return false; // Not a bcrypt hash at all.
    }
    // getRounds does not always throw on malformed input — it can hand back
    // NaN — and NaN !== PASSWORD_COST would report every unreadable hash as
    // needing a rewrite. Only act on a cost we actually understand.
    if (!Number.isInteger(rounds)) return false;
    return rounds !== PASSWORD_COST;
}
