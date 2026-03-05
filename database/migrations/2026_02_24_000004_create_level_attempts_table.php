<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Creates the level_attempts table.
 *
 * Records every attempt a student makes at a dungeon level.
 * A student may attempt the same level multiple times, so
 * attempt_number tracks the ordinal position of each try.
 *
 * This table is append-only: rows are never updated, so only
 * created_at is stored and UPDATED_AT is suppressed on the model.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('level_attempts', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('student_id')
                  ->constrained('students')
                  ->cascadeOnDelete();
            $table->unsignedTinyInteger('level_index');
            $table->boolean('completed')->default(false);
            $table->unsignedInteger('attempt_number');
            $table->unsignedTinyInteger('blocks_used');
            $table->unsignedTinyInteger('block_limit');
            $table->unsignedInteger('ok_count')->default(0);
            $table->unsignedInteger('err_count')->default(0);
            $table->string('fail_reason', 255)->nullable();
            $table->timestamp('created_at')->nullable();

            // Supports fetching all attempts for a student on a given level.
            $table->index(['student_id', 'level_index']);

            // Supports quickly querying whether a student has completed a level.
            $table->index(['student_id', 'level_index', 'completed']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('level_attempts');
    }
};
