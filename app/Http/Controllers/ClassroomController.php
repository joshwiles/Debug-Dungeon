<?php

namespace App\Http\Controllers;

use App\Models\Classroom;
use App\Services\ClassroomCodeGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClassroomController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $teacher = $request->input('auth_user');

        $classrooms = Classroom::where('teacher_id', $teacher->id)
            ->withCount('students')
            ->get()
            ->map(fn ($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'code' => $c->code,
                'student_count' => $c->students_count,
            ]);

        return response()->json([
            'ok' => true,
            'classrooms' => $classrooms,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $teacher = $request->input('auth_user');

        $validated = $request->validate([
            'name' => 'required|string|max:100',
        ]);

        $code = ClassroomCodeGenerator::generate();

        $classroom = Classroom::create([
            'teacher_id' => $teacher->id,
            'name' => $validated['name'],
            'code' => $code,
        ]);

        return response()->json([
            'ok' => true,
            'classroom' => [
                'id' => $classroom->id,
                'name' => $classroom->name,
                'code' => $classroom->code,
            ],
        ], 201);
    }
}
