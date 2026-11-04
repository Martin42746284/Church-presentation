<?php

namespace Tests\Feature;

use Tests\TestCase;

/** Laravel's built-in liveness endpoint used by the Electron host. */
class UpTest extends TestCase
{
    public function test_the_framework_health_endpoint_answers(): void
    {
        $this->get('/up')->assertOk();
    }
}
