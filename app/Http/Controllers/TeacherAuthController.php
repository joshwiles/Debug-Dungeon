<?php

namespace App\Http\Controllers;

use App\Models\Teacher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class TeacherAuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100|unique:teachers,name',
            'password' => 'required|string|min:4|max:255',
        ]);

        $token = Str::random(64);

        $teacher = Teacher::create([
            'name' => $validated['name'],
            'password' => Hash::make($validated['password']),
            'api_token' => $token,
        ]);

        return response()->json([
            'ok' => true,
            'teacher' => [
                'id' => $teacher->id,
                'name' => $teacher->name,
            ],
            'token' => $token,
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string',
            'password' => 'required|string',
        ]);

        $teacher = Teacher::where('name', $validated['name'])->first();

        if (! $teacher || ! Hash::check($validated['password'], $teacher->password)) {
            return response()->json([
                'ok' => false,
                'error' => 'Invalid name or password.',
            ], 401);
        }

        // Rotate token on each login
        $token = Str::random(64);
        $teacher->update(['api_token' => $token]);

        return response()->json([
            'ok' => true,
            'teacher' => [
                'id' => $teacher->id,
                'name' => $teacher->name,
            ],
            'token' => $token,
        ]);
    }
}
