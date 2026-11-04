<?php

namespace Tests\Feature;

use App\Models\Bible;
use App\Models\BibleVerse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BibleTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(string $name): string
    {
        return base_path('tests/fixtures/'.$name);
    }

    private function import(string $file, array $options = []): int
    {
        return $this->artisan('bible:import', ['file' => $this->fixture($file)] + $options)
            ->run();
    }

    public function test_the_import_requires_the_metadata_sidecar(): void
    {
        $this->import('bible-nometa.json');

        $this->assertSame(1, $this->artisan('bible:import', ['file' => $this->fixture('bible-nometa.json')])
            ->run(), 'un fichier sans métadonnées doit être rejeté');

        $this->assertDatabaseCount('bibles', 0);
    }

    public function test_the_import_rejects_incomplete_metadata(): void
    {
        $this->import('bible-badmeta.json');

        $this->assertDatabaseCount('bibles', 0);
    }

    public function test_the_import_rejects_a_translation_that_does_not_match_the_metadata(): void
    {
        $this->import('bible-mismatch.json');

        $this->assertDatabaseCount('bibles', 0);
    }

    public function test_a_translation_is_imported_with_its_licence_metadata(): void
    {
        $this->import('bible-test.json');

        $this->assertDatabaseCount('bibles', 1);
        $this->assertDatabaseCount('bible_verses', 7);

        $bible = Bible::firstOrFail();

        $this->assertSame('test', $bible->code);
        $this->assertSame('Traduction de test', $bible->translation);
        $this->assertSame('Domaine public', $bible->license);
        $this->assertNull($bible->license_url);
        $this->assertSame(7, $bible->verse_count);
        $this->assertSame(2, $bible->book_count);

        // The FTS5 index is populated by the insert triggers.
        $this->assertSame(2, BibleVerse::where('text', 'like', '%lumière%')->count());
    }

    public function test_a_sqlite_database_json_export_is_imported_as_a_translation(): void
    {
        $this->import('bible-sqlite-export.json');

        $bible = Bible::firstOrFail();
        $this->assertSame('mg-test', $bible->code);
        $this->assertSame('Ny Baiboly Malagasy (1865)', $bible->translation);
        $this->assertSame(3, $bible->verse_count);
        $this->assertSame(1, $bible->book_count);

        $this->getJson('/api/bible/books?translation=mg-test')
            ->assertOk()
            ->assertJsonPath('translation', 'Ny Baiboly Malagasy (1865)')
            ->assertJsonPath('data.0.name', 'Genesisy')
            ->assertJsonPath('data.0.abbr', 'Gen')
            ->assertJsonPath('data.0.chapters', 2);

        $this->getJson('/api/bible/chapter?translation=mg-test&book=0&chapter=1')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.text', '[Fampidirana] Tamin’ny voalohany.')
            ->assertJsonPath('data.1.n', 3)
            ->assertJsonPath('data.1.text', 'Ary nisy mazava.');

        $this->getJson('/api/bible/search?translation=mg-test&q=voalohany')
            ->assertOk()
            ->assertJsonPath('data.0.ref', 'Genesisy 1:1');
    }

    public function test_reimporting_is_idempotent_and_force_replaces(): void
    {
        $this->import('bible-test.json');
        $this->import('bible-test.json', ['--if-missing' => true]);
        $this->assertDatabaseCount('bibles', 1);

        $this->import('bible-test.json', ['--force' => true]);
        $this->assertDatabaseCount('bibles', 1);
        $this->assertDatabaseCount('bible_verses', 7);
    }

    public function test_a_second_import_without_force_fails(): void
    {
        $this->import('bible-test.json');

        $this->assertSame(1, $this->artisan('bible:import', ['file' => $this->fixture('bible-test.json')])
            ->run());
    }

    public function test_the_translations_endpoint_exposes_the_licence(): void
    {
        $this->import('bible-test.json');

        $this->getJson('/api/bible')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.code', 'test')
            ->assertJsonPath('data.0.license', 'Domaine public')
            ->assertJsonPath('data.0.retrieved_at', '2026-11-02')
            ->assertJsonPath('data.0.license_url', null);
    }

    public function test_books_and_chapters_are_returned_for_navigation(): void
    {
        $this->import('bible-test.json');

        $this->getJson('/api/bible/books')
            ->assertOk()
            ->assertJsonPath('translation', 'Traduction de test')
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.name', 'Genèse')
            ->assertJsonPath('data.0.chapters', 2)
            ->assertJsonPath('data.1.name', 'Jean')
            ->assertJsonPath('data.1.chapters', 1);

        $this->getJson('/api/bible/chapter?book=0&chapter=1')
            ->assertOk()
            ->assertJsonPath('book.name', 'Genèse')
            ->assertJsonPath('chapter', 1)
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.n', 1)
            ->assertJsonPath('data.0.text', 'Au commencement, Dieu créa les cieux et la terre.');
    }

    public function test_an_unknown_chapter_is_a_404(): void
    {
        $this->import('bible-test.json');

        $this->getJson('/api/bible/chapter?book=0&chapter=99')->assertStatus(404);
        $this->getJson('/api/bible/chapter?book=1')->assertStatus(422);
    }

    public function test_without_any_translation_the_bible_endpoints_answer_404(): void
    {
        $this->getJson('/api/bible/books')->assertStatus(404);
        $this->getJson('/api/bible/chapter?book=0&chapter=1')->assertStatus(404);
        $this->getJson('/api/bible/search?q=commencement')->assertStatus(404);
        $this->getJson('/api/bible')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_full_text_search_finds_a_verse_and_reports_its_reference(): void
    {
        $this->import('bible-test.json');

        $this->getJson('/api/bible/search?q=commencement')
            ->assertOk()
            ->assertJsonPath('query', 'commencement')
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.ref', 'Genèse 1:1')
            ->assertJsonPath('data.0.chapter', 1);

        // Prefix match: the last word matches while the user is still typing.
        $this->getJson('/api/bible/search?q=commenc')
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_search_is_accent_insensitive_and_requires_two_characters(): void
    {
        $this->import('bible-test.json');

        // "lumiere" (sans accent) retrouve "lumière" : tokenize unicode61
        // remove_diacritics 1 (Genèse 1:3 et Jean 1:2).
        $response = $this->getJson('/api/bible/search?q=lumiere')->assertOk()->assertJsonCount(2, 'data');
        $refs = array_column($response->json('data'), 'ref');
        $this->assertContains('Genèse 1:3', $refs);
        $this->assertContains('Jean 1:2', $refs);

        $this->getJson('/api/bible/search?q=a')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->getJson('/api/bible/search?q=')
            ->assertStatus(422);
    }

    public function test_search_returns_no_hit_for_an_unknown_word(): void
    {
        $this->import('bible-test.json');

        $this->getJson('/api/bible/search?q=zorglub')->assertOk()->assertJsonCount(0, 'data');
    }
}
