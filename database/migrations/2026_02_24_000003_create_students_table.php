<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Creates the students table.
 *
 * Students belong to exactly one classroom and are identified
 * within that classroom by their first name, hence the composite
 * unique index on (classroom_id, first_name).
 * Deleting a classroom cascades to all of its students.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('students', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('classroom_id')
                  ->constrained('classrooms')
                  ->cascadeOnDelete();
            $table->string('first_name', 50);
            $table->string('api_token', 64)->nullable()->unique();
            $table->timestamps();

            // A first name must be unique within a single classroom.
            $table->unique(['classroom_id', 'first_name']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('students');
    }
};
