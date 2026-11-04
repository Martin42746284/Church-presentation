<?php

/*
|--------------------------------------------------------------------------
| CORS — local desktop API
|--------------------------------------------------------------------------
|
| The built-in Laravel CORS middleware is disabled: App\Http\Middleware\
| AllowLocalOrigin is registered globally instead and owns both the preflight
| answer and the refusal of foreign origins (it runs before routing, so that
| OPTIONS can be answered even though no route declares that verb).
|
*/

return [
    'paths' => [],
    'allowed_methods' => ['*'],
    'allowed_origins' => ['*'],
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => false,
];
