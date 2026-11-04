<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Media library (phase 7): local images and videos projected by the program.
 *
 * Files live in the user data directory (never in the install directory) and
 * are served back by this controller so the renderer — `file://` page in the
 * packaged app — only ever talks to the local API.
 */
class MediaController extends Controller
{
    public function index(): JsonResponse
    {
        $dir = $this->directory();
        $records = [];

        foreach (glob($dir.'/*') ?: [] as $path) {
            if (is_file($path)) {
                $records[] = $this->record($path);
            }
        }

        usort($records, static fn (array $left, array $right): int => strcmp($left['name'], $right['name']));

        return response()->json(['data' => $records]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate(
            ['file' => ['required', 'file']],
            ['file.required' => 'Aucun fichier reçu.', 'file.file' => "Le fichier n'a pas pu être lu."],
        );

        $file = $request->file('file');
        $extension = strtolower($file->getClientOriginalExtension());
        $accepted = $this->acceptedExtensions();

        if (! in_array($extension, $accepted, true)) {
            return response()->json([
                'message' => sprintf(
                    'Format non pris en charge : .%s. Images acceptées : %s — vidéos : %s.',
                    $extension !== '' ? $extension : '?',
                    implode(', ', config('media.image_extensions')),
                    implode(', ', config('media.video_extensions')),
                ),
            ], 422);
        }

        $maxBytes = ((int) config('media.max_kilobytes')) * 1024;
        $size = (int) $file->getSize();

        if ($size > $maxBytes) {
            return response()->json([
                'message' => sprintf(
                    'Fichier trop volumineux : %s. La taille maximale est de %s.',
                    $this->humanSize($size),
                    $this->humanSize($maxBytes),
                ),
            ], 422);
        }

        $dir = $this->directory();
        if (! is_dir($dir) && ! mkdir($dir, 0775, true) && ! is_dir($dir)) {
            return response()->json([
                'message' => "Dossier de médias inaccessible : {$dir}",
            ], 500);
        }

        $name = $this->uniqueName($file->getClientOriginalName());

        $file->move($dir, $name);

        return response()->json(['data' => $this->record($dir.DIRECTORY_SEPARATOR.$name)], 201);
    }

    /** Streams the file back (the renderer never reaches into the disk). */
    public function show(string $name): JsonResponse|BinaryFileResponse
    {
        $path = $this->path($name);

        if ($path === null) {
            return response()->json(['message' => "Média introuvable : {$name}"], 404);
        }

        return response()->file($path, ['Content-Type' => $this->mimeFor($name)]);
    }

    public function destroy(string $name): JsonResponse
    {
        $path = $this->path($name);

        if ($path === null) {
            return response()->json(['message' => "Média introuvable : {$name}"], 404);
        }

        // A media referenced by a program must not vanish from under it.
        $used = DB::table('program_items')->where('payload->media', $name)->count();

        if ($used > 0) {
            return response()->json([
                'message' => sprintf(
                    'Ce média est utilisé par %d élément(s) de programme. Retirez-le du programme avant de le supprimer.',
                    $used,
                ),
            ], 409);
        }

        unlink($path);

        return response()->json(null, 204);
    }

    /* ------------------------------------------------------------- helpers */

    private function directory(): string
    {
        return (string) config('media.dir');
    }

    /** Absolute path of a stored file, or `null` when the name is unsafe/unknown. */
    private function path(string $name): ?string
    {
        if ($name === '' || str_contains($name, '..') || ! preg_match('/^[A-Za-z0-9._-]+$/', $name)) {
            return null;
        }

        $path = $this->directory().DIRECTORY_SEPARATOR.$name;

        return is_file($path) ? $path : null;
    }

    /** @return string[] */
    private function acceptedExtensions(): array
    {
        return array_merge(config('media.image_extensions'), config('media.video_extensions'));
    }

    /** Keeps the original name, sanitised, and avoids overwriting a neighbour. */
    private function uniqueName(string $original): string
    {
        $base = pathinfo($original, PATHINFO_FILENAME);
        $extension = strtolower(pathinfo($original, PATHINFO_EXTENSION));
        $base = trim((string) preg_replace('/[^A-Za-z0-9._-]+/', '-', $base), '.-_');

        if ($base === '') {
            $base = 'media';
        }

        $name = $base.'.'.$extension;
        $dir = $this->directory();
        $attempt = 1;

        while (is_file($dir.DIRECTORY_SEPARATOR.$name)) {
            $name = $base.'-'.$attempt.'.'.$extension;
            $attempt++;
        }

        return $name;
    }

    /** @return array{name: string, url: string, kind: string, mime: string, size: int, modified_at: string} */
    private function record(string $path): array
    {
        $name = basename($path);
        $extension = strtolower(pathinfo($name, PATHINFO_EXTENSION));

        return [
            'name' => $name,
            'url' => '/api/media/'.rawurlencode($name),
            'kind' => in_array($extension, config('media.video_extensions'), true) ? 'video' : 'image',
            'mime' => $this->mimeFor($name),
            'size' => (int) filesize($path),
            'modified_at' => date(DATE_ATOM, (int) filemtime($path)),
        ];
    }

    private function mimeFor(string $name): string
    {
        return match (strtolower(pathinfo($name, PATHINFO_EXTENSION))) {
            'jpg', 'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            'avif' => 'image/avif',
            'mp4', 'm4v' => 'video/mp4',
            'webm' => 'video/webm',
            'ogv' => 'video/ogg',
            default => 'application/octet-stream',
        };
    }

    private function humanSize(int $bytes): string
    {
        if ($bytes >= 1024 * 1024) {
            return sprintf('%.1f Mo', $bytes / (1024 * 1024));
        }

        if ($bytes >= 1024) {
            return sprintf('%.0f Ko', $bytes / 1024);
        }

        return "{$bytes} o";
    }
}
