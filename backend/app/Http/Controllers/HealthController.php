<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use PDO;

class HealthController extends Controller
{
    /** Liveness/readiness probe used by the Electron host at startup. */
    public function __invoke(): JsonResponse
    {
        $started = microtime(true);

        $database = config('database.connections.sqlite.database');
        $checks = [
            'database' => false,
            'writable' => false,
            'fts5' => false,
            'migrations' => 0,
            'latest_migration' => null,
        ];
        $errors = [];

        try {
            DB::select('select 1');
            $checks['database'] = true;
        } catch (\Throwable $e) {
            $errors['database'] = $e->getMessage();
        }

        $dir = is_string($database) && $database !== ':memory:' ? dirname($database) : null;
        $checks['writable'] = $dir === null || (is_dir($dir) && is_writable($dir));
        if (! $checks['writable']) {
            $errors['writable'] = "Répertoire non inscriptible : {$dir}";
        }

        try {
            $checks['migrations'] = (int) DB::scalar('select count(*) from migrations');
            $checks['latest_migration'] = DB::scalar('select migration from migrations order by id desc limit 1');
        } catch (\Throwable $e) {
            $errors['migrations'] = $e->getMessage();
        }

        try {
            // FTS5 is required by the Bible search (phase 6): probe it on a
            // throwaway in-memory database so a missing build fails loudly
            // here without ever touching the application database.
            $probe = new PDO('sqlite::memory:');
            $probe->exec('CREATE VIRTUAL TABLE health_fts_probe USING fts5(x)');
            $checks['fts5'] = true;
        } catch (\Throwable $e) {
            $errors['fts5'] = $e->getMessage();
        }

        $ok = $checks['database'] && $checks['writable'] && $checks['fts5'];

        return response()->json([
            'status' => $ok ? 'ok' : 'degraded',
            'app' => config('app.name'),
            'version' => config('app.version'),
            'php' => PHP_VERSION,
            'database' => [
                'path' => is_string($database) ? $database : null,
                'driver' => config('database.default'),
            ],
            'checks' => $checks,
            'errors' => (object) $errors,
            'duration_ms' => (int) ((microtime(true) - $started) * 1000),
        ], $ok ? 200 : 503);
    }
}
