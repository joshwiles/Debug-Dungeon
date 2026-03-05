<?php

use Illuminate\Support\Facades\Route;

// Serve the game's index.html for the root and any non-API/non-asset routes
Route::fallback(function () {
    return response()->file(public_path('index.html'));
});
