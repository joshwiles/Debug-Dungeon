<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Represents a teacher who owns one or more classrooms.
 *
 * @property int         $id
 * @property string      $name
 * @property string      $password      Bcrypt-hashed; excluded from serialisation.
 * @property string|null $api_token     Bearer token for API authentication; excluded from serialisation.
 * @property \Illuminate\Support\Carbon $created_at
 * @property \Illuminate\Support\Carbon $updated_at
 *
 * @property-read \Illuminate\Database\Eloquent\Collection<int, Classroom> $classrooms
 */
class Teacher extends Model
{
    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'password',
        'api_token',
    ];

    /**
     * The attributes that should be hidden for serialisation.
     *
     * Prevents password hashes and raw API tokens from leaking
     * into JSON responses or array representations.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'api_token',
    ];

    // -------------------------------------------------------------------------
    // Relationships
    // -------------------------------------------------------------------------

    /**
     * The classrooms owned by this teacher.
     *
     * @return HasMany<Classroom, $this>
     */
    public function classrooms(): HasMany
    {
        return $this->hasMany(Classroom::class);
    }
}
