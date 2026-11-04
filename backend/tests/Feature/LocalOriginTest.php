<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LocalOriginTest extends TestCase
{
    use RefreshDatabase;

    public function test_preflight_from_the_renderer_is_allowed(): void
    {
        $response = $this->options('/api/health', [], [
            'Origin' => 'null',
            'Access-Control-Request-Method' => 'GET',
        ]);

        $response->assertStatus(204);
        $this->assertSame('null', $response->headers->get('Access-Control-Allow-Origin'));
    }

    public function test_a_local_dev_server_origin_is_allowed(): void
    {
        $response = $this->get('/api/health', ['Origin' => 'http://localhost:5174']);

        $response->assertOk();
        $this->assertSame('http://localhost:5174', $response->headers->get('Access-Control-Allow-Origin'));
    }

    public function test_a_remote_origin_is_refused(): void
    {
        $this->get('/api/health', ['Origin' => 'https://evil.example'])
            ->assertStatus(403);
    }

    public function test_a_request_without_origin_still_works(): void
    {
        $this->getJson('/api/health')->assertOk();
    }
}
