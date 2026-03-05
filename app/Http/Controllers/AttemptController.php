<?php

namespace App\Http\Controllers;

use App\Models\LevelAttempt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AttemptController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $student = $request->input('auth_user');

        $validated = $request->validate([
            'level_index' => 'required|integer|min:0|max:20',
            'completed' => 'required|boolean',
            'blocks_used' => 'required|integer|min:0|max:255',
            'block_limit' => 'required|integer|min:1|max:255',
            'ok_count' => 'required|integer|min:0',
            'err_count' => 'required|integer|min:0',
            'fail_reason' => 'nullable|string|max:255',
        ]);

        // Compute attempt number for this student + level
        $attemptNumber = LevelAttempt::where('student_id', $student->id)
            ->where('level_index', $validated['level_index'])
            ->count() + 1;

        $attempt = LevelAttempt::create([
            'student_id' => $student->id,
            'level_index' => $validated['level_index'],
            'completed' => $validated['completed'],
            'attempt_number' => $attemptNumber,
            'blocks_used' => $validated['blocks_used'],
            'block_limit' => $validated['block_limit'],
            'ok_count' => $validated['ok_count'],
            'err_count' => $validated['err_count'],
            'fail_reason' => $validated['fail_reason'] ?? null,
        ]);

        return response()->json([
            'ok' => true,
            'attempt_id' => $attempt->id,
            'attempt_number' => $attemptNumber,
        ], 201);
    }
}
