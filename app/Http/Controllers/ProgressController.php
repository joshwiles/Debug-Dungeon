<?php

namespace App\Http\Controllers;

use App\Models\LevelAttempt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProgressController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $student = $request->input('auth_user');

        $attempts = LevelAttempt::where('student_id', $student->id)->get();

        // Build completed levels list
        $completedLevels = $attempts
            ->where('completed', true)
            ->pluck('level_index')
            ->unique()
            ->values()
            ->all();

        // Build per-level stats
        $stats = [];
        $grouped = $attempts->groupBy('level_index');

        foreach ($grouped as $levelIndex => $levelAttempts) {
            $completed = $levelAttempts->contains('completed', true);
            $completedAttempts = $levelAttempts->where('completed', true);

            $stats[(string) $levelIndex] = [
                'attempts' => $levelAttempts->count(),
                'completed' => $completed,
                'best_blocks' => $completed
                    ? $completedAttempts->min('blocks_used')
                    : $levelAttempts->min('blocks_used'),
                'total_ok' => $levelAttempts->sum('ok_count'),
                'total_err' => $levelAttempts->sum('err_count'),
            ];
        }

        return response()->json([
            'ok' => true,
            'completed_levels' => $completedLevels,
            'stats' => (object) $stats,
        ]);
    }
}
