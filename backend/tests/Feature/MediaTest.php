<?php

namespace Tests\Feature;

use App\Models\Program;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class MediaTest extends TestCase
{
    use RefreshDatabase;

    private string $dir;

    protected function setUp(): void
    {
        parent::setUp();

        $this->dir = sys_get_temp_dir().'/church-media-'.uniqid();
        config(['media.dir' => $this->dir]);
    }

    protected function tearDown(): void
    {
        foreach (glob($this->dir.'/*') ?: [] as $path) {
            if (is_file($path)) {
                unlink($path);
            }
        }

        if (is_dir($this->dir)) {
            rmdir($this->dir);
        }

        parent::tearDown();
    }

    public function test_the_library_starts_empty(): void
    {
        $this->getJson('/api/media')->assertOk()->assertJson(['data' => []]);
    }

    public function test_an_image_can_be_uploaded_listed_and_served(): void
    {
        $source = tempnam(sys_get_temp_dir(), 'church-media-');
        file_put_contents($source, $content = str_repeat('paroles-du-culte', 256));

        $response = $this->post('/api/media', [
            'file' => new UploadedFile($source, 'accueil.jpg', 'image/jpeg', null, true),
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.name', 'accueil.jpg')
            ->assertJsonPath('data.kind', 'image')
            ->assertJsonPath('data.mime', 'image/jpeg')
            ->assertJsonPath('data.size', strlen($content))
            ->assertJsonPath('data.url', '/api/media/accueil.jpg');

        $this->assertFileExists($this->dir.'/accueil.jpg');

        $this->getJson('/api/media')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'accueil.jpg');

        $served = $this->get('/api/media/accueil.jpg');
        $served->assertOk();
        $this->assertStringContainsString('image/jpeg', (string) $served->headers->get('content-type'));
        $this->assertSame($content, file_get_contents($this->dir.'/accueil.jpg'));
    }

    public function test_a_video_is_typed_as_video(): void
    {
        $this->post('/api/media', [
            'file' => UploadedFile::fake()->create('temoignage.mp4', 4, 'video/mp4'),
        ])->assertCreated()->assertJsonPath('data.kind', 'video');
    }

    public function test_an_unsupported_format_is_refused_with_a_readable_message(): void
    {
        $response = $this->post('/api/media', [
            'file' => UploadedFile::fake()->create('notes.txt', 1, 'text/plain'),
        ]);

        $response->assertStatus(422);
        $this->assertStringContainsString('Format non pris en charge', (string) $response->json('message'));
        $this->assertStringContainsString('mp4', (string) $response->json('message'));
        $this->assertFileDoesNotExist($this->dir.'/notes.txt');
    }

    public function test_an_oversized_file_is_refused_with_its_size(): void
    {
        config(['media.max_kilobytes' => 1]);

        $response = $this->post('/api/media', [
            'file' => UploadedFile::fake()->create('gros.mp4', 64, 'video/mp4'),
        ]);

        $response->assertStatus(422);
        $this->assertStringContainsString('trop volumineux', (string) $response->json('message'));
        $this->assertStringContainsString('Ko', (string) $response->json('message'));
    }

    public function test_two_files_with_the_same_name_keep_both(): void
    {
        $this->post('/api/media', ['file' => UploadedFile::fake()->create('photo.jpg', 2)])
            ->assertCreated()->assertJsonPath('data.name', 'photo.jpg');
        $this->post('/api/media', ['file' => UploadedFile::fake()->create('photo.jpg', 2)])
            ->assertCreated()->assertJsonPath('data.name', 'photo-1.jpg');

        $this->assertFileExists($this->dir.'/photo.jpg');
        $this->assertFileExists($this->dir.'/photo-1.jpg');
    }

    public function test_a_media_can_be_deleted(): void
    {
        $this->post('/api/media', ['file' => UploadedFile::fake()->create('temp.png', 2)])
            ->assertCreated();

        $this->deleteJson('/api/media/temp.png')->assertNoContent();
        $this->assertFileDoesNotExist($this->dir.'/temp.png');
        $this->getJson('/api/media')->assertOk()->assertJson(['data' => []]);
    }

    public function test_an_unknown_media_returns_a_french_404(): void
    {
        $this->getJson('/api/media/absent.png')
            ->assertNotFound()
            ->assertJsonPath('message', 'Média introuvable : absent.png');

        $this->deleteJson('/api/media/absent.png')->assertNotFound();
    }

    public function test_a_traversal_attempt_never_leaves_the_library(): void
    {
        file_put_contents($dirname = sys_get_temp_dir().'/church-secret.txt', 'secret');

        $this->getJson('/api/media/..')->assertNotFound();
        $this->deleteJson('/api/media/..')->assertNotFound();

        $this->assertFileExists($dirname);
        unlink($dirname);
    }

    public function test_a_media_used_by_a_program_is_protected(): void
    {
        $this->post('/api/media', ['file' => UploadedFile::fake()->create('slideshow.jpg', 2)])
            ->assertCreated();

        $program = Program::create(['name' => 'Culte', 'date' => '2026-11-08']);
        $program->items()->create([
            'position' => 0,
            'kind' => 'media',
            'title' => 'Diapositive d’accueil',
            'payload' => ['media' => 'slideshow.jpg', 'kind' => 'image'],
        ]);

        $response = $this->deleteJson('/api/media/slideshow.jpg');

        $response->assertStatus(409);
        $this->assertStringContainsString('utilisé par 1', (string) $response->json('message'));
        $this->assertFileExists($this->dir.'/slideshow.jpg');
    }
}
