<?php

namespace Tests\Feature;

use App\Models\Program;
use App\Models\Song;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SongTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_song_can_be_created(): void
    {
        $response = $this->postJson('/api/songs', [
            'title' => 'Grâce infinie',
            'author' => 'John Newton',
            'lang' => 'fr',
            'category' => 'Hymne',
            'lyrics' => "[Couplet 1]\nGrâce infinie, ô quel beau son",
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.title', 'Grâce infinie')
            ->assertJsonPath('data.lang', 'fr');

        $this->assertDatabaseHas('songs', ['title' => 'Grâce infinie']);
        $this->assertNotEmpty($response->json('data.id'));
    }

    public function test_a_song_without_lyrics_is_rejected(): void
    {
        $this->postJson('/api/songs', ['title' => 'Vide'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['lyrics']);
    }

    public function test_the_list_can_be_filtered_and_searched(): void
    {
        Song::create(['title' => 'Amazing Grace', 'lang' => 'en', 'lyrics' => 'lyrics']);
        Song::create(['title' => 'Grâce infinie', 'lang' => 'fr', 'lyrics' => 'paroles']);

        $this->getJson('/api/songs?lang=fr')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Grâce infinie');

        $this->getJson('/api/songs?q=amazing')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_usage_reports_programs_using_the_song(): void
    {
        $song = Song::create(['title' => 'Ancien chant', 'lyrics' => 'x']);
        $other = Song::create(['title' => 'Libre', 'lyrics' => 'y']);

        $this->getJson("/api/songs/{$song->id}/usage")
            ->assertOk()
            ->assertJsonPath('program_items', 0);

        $this->getJson("/api/songs/{$other->id}/usage")->assertOk();
    }

    public function test_an_unused_song_can_be_deleted(): void
    {
        $song = Song::create(['title' => 'À supprimer', 'lyrics' => 'x']);

        $this->deleteJson("/api/songs/{$song->id}")->assertNoContent();

        $this->assertDatabaseMissing('songs', ['id' => $song->id]);
    }

    public function test_a_song_used_by_a_program_cannot_be_deleted(): void
    {
        $song = Song::create(['title' => 'Utilisé', 'lyrics' => 'x']);
        $program = Program::create(['name' => 'Culte', 'date' => '2026-11-08']);
        $program->items()->create(['position' => 0, 'kind' => 'song', 'song_id' => $song->id]);

        $this->deleteJson("/api/songs/{$song->id}")
            ->assertStatus(409)
            ->assertJsonPath('program_items', 1);

        $this->assertDatabaseHas('songs', ['id' => $song->id]);
    }

    public function test_a_protected_song_can_be_deleted_once_removed_from_the_program(): void
    {
        $song = Song::create(['title' => 'Utilisé', 'lyrics' => 'x']);
        $program = Program::create(['name' => 'Culte', 'date' => '2026-11-08']);
        $program->items()->create(['position' => 0, 'kind' => 'song', 'song_id' => $song->id]);

        $this->putJson("/api/programs/{$program->id}", ['items' => []])->assertOk();

        $this->deleteJson("/api/songs/{$song->id}")->assertNoContent();

        $this->assertDatabaseMissing('songs', ['id' => $song->id]);
    }
}
