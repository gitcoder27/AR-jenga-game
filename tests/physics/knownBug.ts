import { it } from 'vitest';

/**
 * A regression test for a bug from GAME_REVIEW.md that is not fixed yet.
 *
 * Runs as `it.fails`, so the suite stays green while proving the bug still
 * reproduces. When the fix lands the test starts passing, `it.fails` reports
 * that as an error, and the fix commit must switch it to a plain `it`.
 *
 * Set SHOW_KNOWN_BUGS=1 to run them as plain tests and see the actual failures.
 */
export const knownBug: typeof it.fails = process.env.SHOW_KNOWN_BUGS ? (it as typeof it.fails) : it.fails;
