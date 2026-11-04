<?php

use App\Http\Controllers\BibleController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\MediaController;
use App\Http\Controllers\ProgramController;
use App\Http\Controllers\SongController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Local API routes
|--------------------------------------------------------------------------
|
| Every route here is served on 127.0.0.1 only. The application is local and
| single-user: there is no authentication (decided at cadrage).
|
*/

Route::get('/health', HealthController::class);

Route::apiResource('songs', SongController::class)->only(['index', 'show', 'store', 'update', 'destroy']);
Route::get('/songs/{song}/usage', [SongController::class, 'usage']);

Route::apiResource('programs', ProgramController::class)->only(['index', 'show', 'store', 'update', 'destroy']);

/*
| Programme lifecycle (phase 6): duplicate/archive/restore are POSTs on the
| resource; `destroy` stays an explicit purge (there is a test for it).
*/
Route::post('/programs/{program}/duplicate', [ProgramController::class, 'duplicate']);
Route::post('/programs/{program}/archive', [ProgramController::class, 'archive']);
Route::post('/programs/{program}/restore', [ProgramController::class, 'restore']);

/*
| Bible (phase 6): navigation, chapter lookup and FTS5 full-text search over
| the translations imported by `php artisan bible:import`.
*/
Route::get('/bible', [BibleController::class, 'index']);
Route::get('/bible/books', [BibleController::class, 'books']);
Route::get('/bible/chapter', [BibleController::class, 'chapter']);
Route::get('/bible/search', [BibleController::class, 'search']);

/*
| Media library (phase 7): local images and videos stored in the user data
| directory and streamed back for the projection window.
*/
Route::get('/media', [MediaController::class, 'index']);
Route::post('/media', [MediaController::class, 'store']);
Route::get('/media/{name}', [MediaController::class, 'show'])->where('name', '[A-Za-z0-9._-]+');
Route::delete('/media/{name}', [MediaController::class, 'destroy'])->where('name', '[A-Za-z0-9._-]+');
