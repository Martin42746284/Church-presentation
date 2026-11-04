<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HealthTest extends TestCase
{
    use RefreshDatabase;

    public function test_health_endpoint_reports_a_working_stack(): void
    {
        $response = $this->getJson('/api/health');

        $response->assertOk()
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('checks.database', true)
            ->assertJsonPath('checks.fts5', true)
            ->assertJsonPath('database.driver', 'sqlite');

        // Migrations have run: users cache/jobs + our phase-3 tables.
        $this->assertGreaterThanOrEqual(6, $response->json('checks.migrations'));
        $this->assertNotNull($response->json('checks.latest_migration'));
    }
}
