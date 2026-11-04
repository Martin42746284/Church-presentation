<?php

use App\Http\Middleware\AllowLocalOrigin;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // The API only binds to 127.0.0.1, but the renderer runs from file://
        // or from the Vite dev server: CORS + origin refusal is handled globally
        // (before routing, so that OPTIONS preflights are answered even though
        // no route is registered for that verb).
        $middleware->append(AllowLocalOrigin::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
