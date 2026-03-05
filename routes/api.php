<?php

use App\Http\Controllers\StudentAuthController;
use App\Http\Controllers\TeacherAuthController;
use App\Http\Controllers\AttemptController;
use App\Http\Controllers\ProgressController;
use App\Http\Controllers\ClassroomController;
use App\Http\Controllers\DashboardController;
use Illuminate\Support\Facades\Route;

// Public (no auth required) — rate-limited
Route::middleware('throttle:10,1')->group(function () {
    Route::post('/student/join', [StudentAuthController::class, 'join']);
    Route::post('/teacher/register', [TeacherAuthController::class, 'register']);
    Route::post('/teacher/login', [TeacherAuthController::class, 'login']);
});

// Student-authenticated routes
Route::middleware('auth.token:student')->group(function () {
    Route::post('/attempts', [AttemptController::class, 'store']);
    Route::get('/progress', [ProgressController::class, 'index']);
});

// Teacher-authenticated routes
Route::middleware('auth.token:teacher')->group(function () {
    Route::get('/classrooms', [ClassroomController::class, 'index']);
    Route::post('/classrooms', [ClassroomController::class, 'store']);
    Route::get('/classrooms/{code}/dashboard', [DashboardController::class, 'show']);
});
