<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Allows cross-origin calls to the local API from the desktop renderer.
 *
 * The server only ever binds to 127.0.0.1, so the risk surface is a local
 * page talking to a local API. Any other origin is refused: no CORS header is
 * emitted, which makes the browser block the response.
 */
class AllowLocalOrigin
{
    /** Origins the renderer may come from. */
    private const ALLOWED = ['null', 'http://localhost', 'http://127.0.0.1'];

    public function handle(Request $request, Closure $next): Response
    {
        $origin = $request->headers->get('Origin');

        if ($this->isAllowed($origin)) {
            if ($request->isMethod('OPTIONS')) {
                return response()->noContent(204, [
                    'Access-Control-Allow-Origin' => $origin,
                    'Access-Control-Allow-Methods' => 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers' => 'Content-Type, Authorization, X-Requested-With',
                    'Access-Control-Max-Age' => '600',
                ]);
            }

            $response = $next($request);
            $response->headers->set('Access-Control-Allow-Origin', $origin);
            $response->headers->set('Vary', 'Origin');

            return $response;
        }

        // No Origin header: non-browser client (curl, Electron main, tests).
        if ($origin === null) {
            return $next($request);
        }

        return response()->json(['message' => 'Origine non autorisée.'], 403);
    }

    private function isAllowed(?string $origin): bool
    {
        if ($origin === null) {
            return false;
        }

        if (in_array($origin, self::ALLOWED, true)) {
            return true;
        }

        foreach (['http://localhost:', 'http://127.0.0.1:'] as $prefix) {
            if (str_starts_with($origin, $prefix)) {
                return true;
            }
        }

        return false;
    }
}
