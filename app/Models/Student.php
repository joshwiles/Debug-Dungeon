<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Represents a student enrolled in a classroom.
 *
 * Within a classroom, a student is uniquely identified by their
 * first name. The api_token is used for game-session authentication
 * and is never included in serialised output.
 *
 * @property int         $id
 * @property int         $classroom_id
 * @property string      $first_name
 * @property string|null $api_token     Bearer token; excluded from serialisation.
 * @property \Illuminate\Support\Carbon $created_at
 * @property \Illuminate\Support\Carbon $updated_at
 *
 * @property-read Classroom                                                          $classroom
 * @property-read \Illuminate\Database\Eloquent\Collection<int, LevelAttempt>        $attempts
 */
class Student extends Model
{
    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'classroom_id',
        'first_name',
        'api_token',
    ];

    /**
     * The attributes that should be hidden for serialisation.
     *
     * @var list<string>
     */
    protected $hidden = [
        'api_token',
    ];

    // -------------------------------------------------------------------------
    // Relationships
    // -------------------------------------------------------------------------

    /**
     * The classroom this student belongs to.
     *
     * @return BelongsTo<Classroom, $this>
     */
    public function classroom(): BelongsTo
    {
        return $this->belongsTo(Classroom::class);
    }

    /**
     * All level attempts recorded for this student.
     *
     * @return HasMany<LevelAttempt, $this>
     */
    public function attempts(): HasMany
    {
        return $this->hasMany(LevelAttempt::class);
    }
}
