<?php

namespace App\Services;

use App\Models\Classroom;
use RuntimeException;

/**
 * Generates unique 6-character classroom join codes.
 *
 * The alphabet deliberately excludes visually ambiguous characters:
 *   O  (confused with 0)
 *   0  (confused with O)
 *   I  (confused with 1 or l)
 *   1  (confused with I or l)
 *   L  (confused with 1 or I)
 *
 * This makes codes safe to communicate verbally or hand-write without
 * participants mis-entering characters.
 */
class ClassroomCodeGenerator
{
    /**
     * The character set used when building codes.
     * 30 characters total, all uppercase letters and digits.
     */
    private const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

    /**
     * Length of each generated code.
     */
    private const CODE_LENGTH = 6;

    /**
     * Maximum number of generation attempts before giving up.
     *
     * At 30 characters and 6 positions there are 30^6 = 729,000,000 possible
     * codes, so collisions should be extremely rare in practice. Ten retries
     * is a generous ceiling that guards against pathological scenarios (e.g.
     * a test database seeded with many codes) without looping forever.
     */
    private const MAX_ATTEMPTS = 10;

    /**
     * Generate a unique 6-character classroom code.
     *
     * Attempts up to MAX_ATTEMPTS times to produce a code that does not
     * already exist in the classrooms table, then throws if all attempts
     * are exhausted.
     *
     * @return string  A 6-character uppercase alphanumeric code.
     *
     * @throws RuntimeException  If a unique code cannot be found within the
     *                           allowed number of attempts.
     */
    public static function generate(): string
    {
        for ($attempt = 1; $attempt <= self::MAX_ATTEMPTS; $attempt++) {
            $code = self::randomCode();

            if (!Classroom::where('code', $code)->exists()) {
                return $code;
            }
        }

        throw new RuntimeException(
            sprintf(
                'Unable to generate a unique classroom code after %d attempts.',
                self::MAX_ATTEMPTS,
            )
        );
    }

    /**
     * Build a random code string of CODE_LENGTH characters from ALPHABET.
     *
     * Uses random_int() for cryptographically secure randomness, which
     * ensures codes are not predictable even if an attacker knows the
     * alphabet and code length.
     *
     * @return string
     */
    private static function randomCode(): string
    {
        $alphabetLength = strlen(self::ALPHABET);
        $code = '';

        for ($i = 0; $i < self::CODE_LENGTH; $i++) {
            $code .= self::ALPHABET[random_int(0, $alphabetLength - 1)];
        }

        return $code;
    }
}
