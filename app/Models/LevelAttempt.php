<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Records a single attempt by a student at a dungeon level.
 *
 * This model is append-only; rows are inserted but never updated.
 * Consequently, only created_at is stored and UPDATED_AT is disabled.
 *
 * ok_count and err_count reflect the number of test assertions that
 * passed and failed respectively during the attempt.
 *
 * @property int         $id
 * @property int         $student_id
 * @property int         $level_index      Zero-based index of the dungeon level.
 * @property bool        $completed        Whether the student passed all assertions.
 * @property int         $attempt_number   Ordinal position of this attempt for the student/level pair.
 * @property int         $blocks_used      Number of code blocks placed by the student.
 * @property int         $block_limit      Maximum blocks permitted on this level.
 * @property int         $ok_count         Passing assertion count.
 * @property int         $err_count        Failing assertion count.
 * @property string|null $fail_reason      Human-readable reason for failure, if applicable.
 * @property \Illuminate\Support\Carbon|null $created_at
 *
 * @property-read Student $student
 */
class LevelAttempt extends Model
{
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'level_attempts';

    /**
     * Disable the updated_at timestamp.
     *
     * Attempts are immutable records; there is no meaningful
     * "last updated" concept for this table.
     */
    const UPDATED_AT = null;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'student_id',
        'level_index',
        'completed',
        'attempt_number',
        'blocks_used',
        'block_limit',
        'ok_count',
        'err_count',
        'fail_reason',
    ];

    /**
     * The attributes that should be cast to native types.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'completed' => 'boolean',
    ];

    // -------------------------------------------------------------------------
    // Relationships
    // -------------------------------------------------------------------------

    /**
     * The student who made this attempt.
     *
     * @return BelongsTo<Student, $this>
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }
}
