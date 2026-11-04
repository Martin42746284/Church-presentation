<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use JsonException;
use Throwable;

class ImportSongs extends Command
{
    protected $signature = 'songs:import {file : JSON exported from the addF_r6 SQLite database}';

    protected $description = 'Importe le recueil Hira dans la bibliothèque de chants';

    public function handle(): int
    {
        $path = (string) $this->argument('file');

        if (!is_readable($path)) {
            $this->error("Fichier introuvable : {$path}");

            return self::FAILURE;
        }

        try {
            $json = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $error) {
            $this->error("JSON invalide : {$error->getMessage()}");

            return self::FAILURE;
        }

        $sourceSongs = is_array($json) ? ($json['table_hira'] ?? null) : null;
        if (!is_array($sourceSongs)) {
            $this->error('Le fichier doit contenir un tableau "table_hira".');

            return self::FAILURE;
        }

        $songs = [];
        $sourceIds = [];
        foreach ($sourceSongs as $sourceSong) {
            if (
                !is_array($sourceSong)
                || !isset($sourceSong['_id'], $sourceSong['title'], $sourceSong['content'])
                || (!is_int($sourceSong['_id']) && !is_string($sourceSong['_id']))
                || !is_string($sourceSong['title'])
                || !is_string($sourceSong['content'])
                || trim((string) $sourceSong['_id']) === ''
                || trim($sourceSong['title']) === ''
            ) {
                $this->error('Chaque chant doit avoir un identifiant, un titre et des paroles valides.');

                return self::FAILURE;
            }

            $sourceId = (string) $sourceSong['_id'];
            if (isset($sourceIds[$sourceId])) {
                $this->error("Identifiant de chant dupliqué : {$sourceId}.");

                return self::FAILURE;
            }
            $sourceIds[$sourceId] = true;

            $lyrics = $this->plainText($sourceSong['content']);
            if ($lyrics === '') {
                $this->error("Les paroles du chant {$sourceId} sont vides.");

                return self::FAILURE;
            }

            $category = $sourceSong['namelist'] ?? null;
            $songs[] = [
                'id' => $this->stableId($sourceId),
                'title' => trim($sourceSong['title']),
                'author' => null,
                'lang' => 'mg',
                'category' => is_string($category) && trim($category) !== '' ? trim($category) : null,
                'collection' => 'Hira',
                'lyrics' => $lyrics,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        if ($songs === []) {
            $this->error('Aucun chant à importer.');

            return self::FAILURE;
        }

        try {
            $imported = DB::transaction(function () use ($songs): int {
                $count = 0;
                foreach (array_chunk($songs, 200) as $chunk) {
                    $count += DB::table('songs')->insertOrIgnore($chunk);
                }

                return $count;
            }, 3);
        } catch (Throwable $error) {
            $this->error("Échec de l'import : {$error->getMessage()}");

            return self::FAILURE;
        }

        $this->info(sprintf(
            'Recueil Hira : %d chant(s) importé(s), %d déjà présent(s).',
            $imported,
            count($songs) - $imported,
        ));

        return self::SUCCESS;
    }

    private function plainText(string $html): string
    {
        $text = preg_replace('/<\s*br\b[^>]*\/?>/iu', "\n", $html);
        $text = preg_replace('/<\/\s*(p|div|li|h[1-6])\s*>/iu', "\n\n", $text ?? $html);
        $text = html_entity_decode(strip_tags($text ?? $html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = str_replace(["\r\n", "\r", "\u{00A0}"], ["\n", "\n", ' '], $text);
        $text = preg_replace('/[ \t]*\n[ \t]*/u', "\n", $text);
        $text = preg_replace('/\n{3,}/u', "\n\n", $text);

        return trim($text ?? '');
    }

    private function stableId(string $sourceId): string
    {
        $hex = substr(hash('sha256', 'church-presentation:addF_r6:'.$sourceId), 0, 32);
        $hex[12] = '5';
        $hex[16] = 'a';

        return implode('-', [
            substr($hex, 0, 8),
            substr($hex, 8, 4),
            substr($hex, 12, 4),
            substr($hex, 16, 4),
            substr($hex, 20, 12),
        ]);
    }
}
