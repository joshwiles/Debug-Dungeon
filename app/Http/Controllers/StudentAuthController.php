<?php

namespace App\Http\Controllers;

use App\Models\Classroom;
use App\Models\Student;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class StudentAuthController extends Controller
{
    public function join(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'classroom_code' => 'required|string|size:6|alpha_num',
            'first_name' => 'required|string|max:50|min:1',
        ]);

        $classroom = Classroom::where('code', strtoupper($validated['classroom_code']))->first();

        if (! $classroom) {
            return response()->json([
                'ok' => false,
                'error' => 'Classroom not found. Check the code and try again.',
            ], 422);
        }

        // Find or create student (idempotent join)
        $student = Student::firstOrCreate(
            [
                'classroom_id' => $classroom->id,
                'first_name' => trim($validated['first_name']),
            ],
        );

        // Generate token if the student doesn't have one yet
        if (! $student->api_token) {
            $student->update(['api_token' => Str::random(64)]);
        }

        return response()->json([
            'ok' => true,
            'student' => [
                'id' => $student->id,
                'first_name' => $student->first_name,
                'classroom_id' => $student->classroom_id,
                'classroom_name' => $classroom->name,
            ],
            'token' => $student->api_token,
        ]);
    }
}
