<?php

namespace Tests\Feature;

use App\Models\Song;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ImportSongsTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_imports_the_supplied_hira_recital(): void
    {
        $file = base_path('../addF_r6.json');
        self::assertFileExists($file);

        $this->artisan('songs:import', ['file' => $file])
            ->expectsOutput('Recueil Hira : 543 chant(s) importé(s), 0 déjà présent(s).')
            ->assertExitCode(0);

        $this->assertDatabaseCount('songs', 543);
        $song = Song::query()->where('title', 'Deraiko ianao Tompo Tsitoha')->sole();
        $this->assertSame('mg', $song->lang);
        $this->assertSame('Sokajy hafa', $song->category);
        $this->assertStringContainsString('Deraiko Ianao Tompo Tsitoha', $song->lyrics);
        $this->assertStringNotContainsString('<p>', $song->lyrics);
        $this->assertStringNotContainsString('&agrave;', $song->lyrics);
    }

    public function test_it_imports_hira_songs_as_plain_text_and_is_safe_to_repeat(): void
    {
        $file = tempnam(sys_get_temp_dir(), 'hira-');
        self::assertNotFalse($file);

        file_put_contents($file, json_encode([
            'table_hira' => [
                [
                    '_id' => 1,
                    'namelist' => 'Fiderana',
                    'title' => 'Deraiko ianao',
                    'content' => '<p>Deraiko Ianao<br />Tompo Tsitoha &ocirc;!</p><p><strong>Amen</strong></p>',
                ],
            ],
        ], JSON_THROW_ON_ERROR));

        try {
            $this->artisan('songs:import', ['file' => $file])
                ->expectsOutput('Recueil Hira : 1 chant(s) importé(s), 0 déjà présent(s).')
                ->assertExitCode(0);

            $song = Song::query()->sole();
            $this->assertSame('mg', $song->lang);
            $this->assertSame('Fiderana', $song->category);
            $this->assertSame('Hira', $song->collection);
            $this->assertSame("Deraiko Ianao\nTompo Tsitoha ô!\n\nAmen", $song->lyrics);

            $song->update(['title' => 'Titre modifié', 'lyrics' => 'Paroles modifiées']);

            $this->artisan('songs:import', ['file' => $file])
                ->expectsOutput('Recueil Hira : 0 chant(s) importé(s), 1 déjà présent(s).')
                ->assertExitCode(0);

            $this->assertSame('Titre modifié', $song->fresh()->title);
            $this->assertSame('Paroles modifiées', $song->fresh()->lyrics);
        } finally {
            unlink($file);
        }
    }
}
