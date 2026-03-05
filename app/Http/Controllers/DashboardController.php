<?php

namespace App\Http\Controllers;

use App\Models\Classroom;
use App\Models\LevelAttempt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    private const TOTAL_LEVELS = 8;

    public function show(Request $request, string $code): JsonResponse
    {
        $teacher = $request->input('auth_user');

        $classroom = Classroom::where('code', $code)
            ->where('teacher_id', $teacher->id)
            ->first();

        if (! $classroom) {
            return response()->json([
                'ok' => false,
                'error' => 'Classroom not found.',
            ], 404);
        }

        $students = $classroom->students()->with('attempts')->get();

        $studentData = $students->map(function ($student) {
            $attempts = $student->attempts;
            $grouped = $attempts->groupBy('level_index');

            // Per-level stats
            $levels = [];
            foreach ($grouped as $levelIndex => $levelAttempts) {
                $completed = $levelAttempts->contains('completed', true);
                $completedAttempts = $levelAttempts->where('completed', true);
                $totalOk = $levelAttempts->sum('ok_count');
                $totalErr = $levelAttempts->sum('err_count');
                $total = $totalOk + $totalErr;

                $levels[(string) $levelIndex] = [
                    'completed' => $completed,
                    'attempts' => $levelAttempts->count(),
                    'best_blocks' => $completed
                        ? $completedAttempts->min('blocks_used')
                        : $levelAttempts->min('blocks_used'),
                    'block_limit' => $levelAttempts->first()->block_limit,
                    'ok_ratio' => $total > 0 ? round($totalOk / $total, 2) : null,
                    'fail_reasons' => $levelAttempts->where('completed', false)
                        ->pluck('fail_reason')
                        ->filter()
                        ->values()
                        ->all(),
                ];
            }

            // Aggregate stats
            $levelsCompleted = $grouped->filter(
                fn ($la) => $la->contains('completed', true)
            )->count();

            // Stars: levels completed on first attempt
            $stars = $grouped->filter(function ($la) {
                $sorted = $la->sortBy('attempt_number');
                $first = $sorted->first();
                return $first && $first->completed;
            })->count();

            // Efficiency: avg(block_limit / best_blocks * 100) across completed levels, capped at 100
            $efficiencies = [];
            foreach ($levels as $lv) {
                if ($lv['completed'] && $lv['best_blocks'] > 0) {
                    $efficiencies[] = min(100, round($lv['block_limit'] / $lv['best_blocks'] * 100));
                }
            }
            $efficiency = count($efficiencies) > 0
                ? round(array_sum($efficiencies) / count($efficiencies))
                : 0;

            // Last active
            $lastAttempt = $attempts->sortByDesc('created_at')->first();

            return [
                'id' => $student->id,
                'first_name' => $student->first_name,
                'levels_completed' => $levelsCompleted,
                'total_levels' => self::TOTAL_LEVELS,
                'stars' => $stars,
                'total_attempts' => $attempts->count(),
                'efficiency' => $efficiency,
                'last_active' => $lastAttempt?->created_at?->toIso8601String(),
                'levels' => (object) $levels,
            ];
        });

        // Sort leaderboard by levels completed desc, then stars desc, then efficiency desc
        $leaderboard = $studentData->sortByDesc(function ($s) {
            return [$s['levels_completed'], $s['stars'], $s['efficiency']];
        })->values();

        return response()->json([
            'ok' => true,
            'classroom' => [
                'id' => $classroom->id,
                'name' => $classroom->name,
                'code' => $classroom->code,
            ],
            'students' => $leaderboard,
        ]);
    }
}
