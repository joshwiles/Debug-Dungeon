<?php

namespace App\Http\Middleware;

use App\Models\Student;
use App\Models\Teacher;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Authenticates requests via a Bearer token in the Authorization header.
 *
 * Resolves the token to either a Student or Teacher model depending on the
 * role parameter supplied when the middleware is registered on a route.
 *
 * Usage:
 *   middleware('auth.token:student')
 *   middleware('auth.token:teacher')
 *   middleware('auth.token')          // tries teacher first, then student
 *
 * On success, merges 'auth_user' and 'auth_role' into the request.
 * On failure, returns a 401 JSON response.
 */
class TokenAuth
{
    /**
     * Handle an incoming request.
     *
     * @param  Request  $request  The incoming HTTP request.
     * @param  Closure  $next     The next middleware handler.
     * @param  string|null  $role  The expected role: 'student', 'teacher', or null for auto-detect.
     * @return JsonResponse|\Illuminate\Http\Response|\Symfony\Component\HttpFoundation\Response
     */
    public function handle(Request $request, Closure $next, ?string $role = null): mixed
    {
        $token = $this->extractBearerToken($request);

        if ($token === null) {
            return $this->unauthorized();
        }

        [$user, $resolvedRole] = $this->resolveUser($token, $role);

        if ($user === null) {
            return $this->unauthorized();
        }

        $request->merge([
            'auth_user' => $user,
            'auth_role' => $resolvedRole,
        ]);

        return $next($request);
    }

    /**
     * Extract the raw token string from the Authorization header.
     *
     * Returns null if the header is absent, malformed, or contains an empty token.
     *
     * @param  Request  $request
     * @return string|null
     */
    private function extractBearerToken(Request $request): ?string
    {
        $header = $request->header('Authorization', '');

        if (!str_starts_with($header, 'Bearer ')) {
            return null;
        }

        $token = trim(substr($header, 7));

        return $token !== '' ? $token : null;
    }

    /**
     * Resolve the authenticated user model from the given token and role hint.
     *
     * When a role is explicitly provided, only that model is queried.
     * When no role is provided, Teacher is attempted first, then Student,
     * matching the assumption that teacher accounts are less common and
     * a successful teacher hit avoids a redundant Student query.
     *
     * @param  string  $token  The raw Bearer token.
     * @param  string|null  $role  The expected role: 'student', 'teacher', or null.
     * @return array{0: \Illuminate\Database\Eloquent\Model|null, 1: string|null}
     *         A tuple of [model instance or null, role string or null].
     */
    private function resolveUser(string $token, ?string $role): array
    {
        if ($role === 'student') {
            $user = Student::where('api_token', $token)->first();

            return [$user, $user !== null ? 'student' : null];
        }

        if ($role === 'teacher') {
            $user = Teacher::where('api_token', $token)->first();

            return [$user, $user !== null ? 'teacher' : null];
        }

        // No role specified: probe teacher then student.
        $teacher = Teacher::where('api_token', $token)->first();
        if ($teacher !== null) {
            return [$teacher, 'teacher'];
        }

        $student = Student::where('api_token', $token)->first();
        if ($student !== null) {
            return [$student, 'student'];
        }

        return [null, null];
    }

    /**
     * Build a standardised 401 Unauthorized JSON response.
     *
     * @return JsonResponse
     */
    private function unauthorized(): JsonResponse
    {
        return response()->json(['ok' => false, 'error' => 'Unauthorized'], 401);
    }
}
