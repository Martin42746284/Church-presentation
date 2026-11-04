<?php

namespace Tests\Feature;

use App\Models\Program;
use App\Models\Song;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProgramTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_program_can_be_created_with_items_in_order(): void
    {
        $song = Song::create(['title' => 'Grâce infinie', 'lyrics' => "ligne\nligne"]);

        $response = $this->postJson('/api/programs', [
            'name' => 'Culte du dimanche',
            'date' => '2026-11-08',
            'items' => [
                ['kind' => 'text', 'title' => 'Bienvenue', 'body' => 'Tongasoa eto'],
                ['kind' => 'song', 'song_id' => $song->id],
                ['kind' => 'verse', 'payload' => ['ref' => 'Jean 3:16']],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.name', 'Culte du dimanche')
            ->assertJsonPath('data.items.0.position', 0)
            ->assertJsonPath('data.items.1.song.title', 'Grâce infinie')
            ->assertJsonPath('data.items.2.kind', 'verse');

        $this->assertDatabaseCount('program_items', 3);
    }

    public function test_an_unknown_kind_is_rejected(): void
    {
        $this->postJson('/api/programs', [
            'name' => 'X',
            'date' => '2026-11-08',
            'items' => [['kind' => 'telepathy']],
        ])->assertStatus(422)->assertJsonValidationErrors(['items.0.kind']);
    }

    public function test_a_media_item_keeps_its_payload(): void
    {
        $this->postJson('/api/programs', [
            'name' => 'Culte',
            'date' => '2026-11-08',
            'items' => [
                ['kind' => 'media', 'title' => 'Accueil', 'payload' => ['media' => 'accueil.jpg', 'kind' => 'image']],
                ['kind' => 'media', 'title' => 'Témoignage', 'payload' => ['media' => 'temoignage.mp4', 'kind' => 'video']],
            ],
        ])->assertCreated()
            ->assertJsonPath('data.items.0.kind', 'media')
            ->assertJsonPath('data.items.0.payload.media', 'accueil.jpg')
            ->assertJsonPath('data.items.1.payload.kind', 'video');
    }

    public function test_deleting_a_program_removes_its_items_but_keeps_songs(): void
    {
        $song = Song::create(['title' => 'Chant', 'lyrics' => 'x']);
        $program = Program::create(['name' => 'Culte', 'date' => '2026-11-08']);
        $program->items()->create(['position' => 0, 'kind' => 'song', 'song_id' => $song->id]);

        $this->deleteJson("/api/programs/{$program->id}")->assertNoContent();

        $this->assertDatabaseCount('program_items', 0);
        $this->assertDatabaseHas('songs', ['id' => $song->id]);
    }

    public function test_a_song_in_use_reports_its_usage(): void
    {
        $song = Song::create(['title' => 'Utilisé', 'lyrics' => 'x']);
        $program = Program::create(['name' => 'Culte', 'date' => '2026-11-08']);
        $program->items()->create(['position' => 0, 'kind' => 'song', 'song_id' => $song->id]);

        $this->getJson("/api/songs/{$song->id}/usage")
            ->assertOk()
            ->assertJsonPath('program_items', 1);
    }

    public function test_updating_a_program_replaces_its_items_in_order(): void
    {
        $song = Song::create(['title' => 'Chant', 'lyrics' => 'x']);
        $program = Program::create(['name' => 'Culte', 'date' => '2026-11-08']);
        $program->items()->create(['position' => 0, 'kind' => 'text', 'title' => 'Ancien', 'body' => 'x']);

        $this->putJson("/api/programs/{$program->id}", [
            'name' => 'Culte (mis à jour)',
            'items' => [
                ['kind' => 'song', 'song_id' => $song->id],
                ['kind' => 'text', 'title' => 'Annonce', 'body' => 'Bonjour'],
            ],
        ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Culte (mis à jour)')
            ->assertJsonPath('data.items.0.position', 0)
            ->assertJsonPath('data.items.0.song_id', $song->id)
            ->assertJsonPath('data.items.1.position', 1)
            ->assertJsonPath('data.items.1.title', 'Annonce');

        $this->assertDatabaseCount('program_items', 2);
        $this->assertDatabaseHas('programs', ['name' => 'Culte (mis à jour)']);
    }

    public function test_an_empty_item_list_clears_the_program(): void
    {
        $program = Program::create(['name' => 'Culte', 'date' => '2026-11-08']);
        $program->items()->create(['position' => 0, 'kind' => 'text', 'title' => 'Ancien', 'body' => 'x']);

        $this->putJson("/api/programs/{$program->id}", ['items' => []])
            ->assertOk()
            ->assertJsonCount(0, 'data.items');

        $this->assertDatabaseCount('program_items', 0);
    }

    public function test_updating_a_program_can_leave_the_items_untouched(): void
    {
        $program = Program::create(['name' => 'Culte', 'date' => '2026-11-08']);
        $program->items()->create(['position' => 0, 'kind' => 'text', 'title' => 'Seul', 'body' => 'x']);

        $this->putJson("/api/programs/{$program->id}", ['name' => 'Renommé'])
            ->assertOk()
            ->assertJsonPath('data.items.0.title', 'Seul');

        $this->assertDatabaseCount('program_items', 1);
    }

    public function test_an_unknown_item_kind_is_rejected_on_update(): void
    {
        $program = Program::create(['name' => 'Culte', 'date' => '2026-11-08']);

        $this->putJson("/api/programs/{$program->id}", [
            'items' => [['kind' => 'telepathy']],
        ])->assertStatus(422)->assertJsonValidationErrors(['items.0.kind']);
    }

    public function test_song_and_verse_items_are_snapshotted_when_the_program_is_saved(): void
    {
        $song = Song::create([
            'title' => 'Grâce infinie',
            'author' => 'John Newton',
            'lang' => 'fr',
            'lyrics' => "[Couplet 1]\nAncien texte",
        ]);

        $this->postJson('/api/programs', [
            'name' => 'Culte',
            'date' => '2026-11-08',
            'items' => [
                ['kind' => 'song', 'song_id' => $song->id],
                [
                    'kind' => 'verse',
                    'title' => 'Jean 3:16',
                    'body' => 'Dieu a tant aimé le monde',
                    'payload' => [
                        'ref' => 'Jean 3:16',
                        'translation' => 'Louis Segond 1910',
                        'verses' => [['label' => 'Jean 3:16', 'text' => 'Dieu a tant aimé le monde']],
                    ],
                ],
                ['kind' => 'text', 'title' => 'Annonce', 'body' => 'x'],
            ],
        ])->assertCreated()
            ->assertJsonPath('data.items.0.snapshot.title', 'Grâce infinie')
            ->assertJsonPath('data.items.0.snapshot.author', 'John Newton')
            ->assertJsonPath('data.items.0.snapshot.lyrics', "[Couplet 1]\nAncien texte")
            ->assertJsonPath('data.items.1.snapshot.ref', 'Jean 3:16')
            ->assertJsonPath('data.items.1.snapshot.verses.0.label', 'Jean 3:16')
            ->assertJsonPath('data.items.2.snapshot', null);
    }

    public function test_the_snapshot_keeps_the_projected_text_after_the_song_changes(): void
    {
        $song = Song::create(['title' => 'Chant', 'lyrics' => 'Texte projeté']);

        $program = $this->postJson('/api/programs', [
            'name' => 'Culte',
            'date' => '2026-11-08',
            'items' => [['kind' => 'song', 'song_id' => $song->id]],
        ])->json('data');

        $this->putJson("/api/songs/{$song->id}", ['lyrics' => 'Texte corrigé'])->assertOk();

        $this->getJson("/api/programs/{$program['id']}")
            ->assertOk()
            ->assertJsonPath('data.items.0.snapshot.lyrics', 'Texte projeté');

        // The API refuses to delete a song still in use (409), so this deletes
        // it at the model level to simulate content disappearing anyway (older
        // backup restored, manual cleanup, …). The program must keep its text.
        Song::where('id', $song->id)->delete();

        $this->getJson("/api/programs/{$program['id']}")
            ->assertOk()
            ->assertJsonPath('data.items.0.song_id', null)
            ->assertJsonPath('data.items.0.snapshot.lyrics', 'Texte projeté');
    }

    public function test_a_program_can_be_duplicated_with_its_items_and_snapshots(): void
    {
        $song = Song::create(['title' => 'Chant', 'lyrics' => 'Texte projeté']);
        $program = Program::create(['name' => 'Culte', 'date' => '2026-11-08']);
        $program->items()->create([
            'position' => 0,
            'kind' => 'song',
            'song_id' => $song->id,
            'snapshot' => ['title' => 'Chant', 'lyrics' => 'Texte projeté'],
        ]);

        $this->postJson("/api/programs/{$program->id}/duplicate")
            ->assertCreated()
            ->assertJsonPath('data.name', 'Culte (copie)')
            ->assertJsonPath('data.date', '2026-11-08')
            ->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.items.0.snapshot.lyrics', 'Texte projeté');

        $this->assertDatabaseCount('programs', 2);
        $this->assertDatabaseCount('program_items', 2);
        $this->assertDatabaseHas('programs', ['id' => $program->id, 'name' => 'Culte']);
    }

    public function test_a_program_can_be_archived_and_restored(): void
    {
        $active = Program::create(['name' => 'Actif', 'date' => '2026-11-08']);
        $old = Program::create(['name' => 'Ancien', 'date' => '2026-11-01']);

        $archived = $this->postJson("/api/programs/{$old->id}/archive")->assertOk();
        $this->assertNotNull($archived->json('data.archived_at'));

        // The workspace list hides the archive by default.
        $this->getJson('/api/programs')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $active->id);

        $this->getJson('/api/programs?archived=only')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $old->id);

        $this->getJson('/api/programs?archived=1')->assertOk()->assertJsonCount(2, 'data');

        $this->postJson("/api/programs/{$old->id}/restore")->assertOk();

        $this->getJson('/api/programs')->assertOk()->assertJsonCount(2, 'data');
    }
}
