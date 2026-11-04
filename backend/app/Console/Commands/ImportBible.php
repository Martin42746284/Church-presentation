<?php

namespace App\Console\Commands;

use App\Models\Bible;
use App\Models\BibleVerse;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use JsonException;
use Throwable;

/**
 * Imports a Bible translation from the JSON shipped with the project.
 *
 * Rule (docs/phase-1-cadrage.md §3.1): a file without the six metadata keys
 * `translation, source, edition, retrieved_at, license, license_url` is
 * rejected. They live in a sidecar `<name>.meta.json` next to the JSON; the
 * `translation` there is cross-checked against the JSON itself.
 */
class ImportBible extends Command
{
    protected $signature = 'bible:import
        {file : JSON translation file (the sidecar <name>.meta.json is mandatory)}
        {--force : Replace an already imported translation}
        {--if-missing : Exit successfully when the translation is already imported}';

    protected $description = 'Importe une traduction biblique et ses métadonnées de licence (Phase 6)';

    /** Non-empty string keys required by the cadrage §3.1. */
    private const REQUIRED = ['translation', 'source', 'edition', 'retrieved_at', 'license'];

    /** Required key that may legitimately be null (public domain: no publisher page). */
    private const NULLABLE = ['license_url'];

    private const CHUNK = 500;

    public function handle(): int
    {
        $path = (string) $this->argument('file');

        if (!is_readable($path)) {
            $this->error("Fichier introuvable : {$path}");

            return self::FAILURE;
        }

        $meta = $this->readMetadata($path);
        if ($meta === null) {
            return self::FAILURE;
        }

        $json = $this->readBible($path, $meta);
        if ($json === null) {
            return self::FAILURE;
        }

        $code = $this->resolveCode($path, $meta);

        $existing = Bible::where('code', $code)->first();
        if ($existing !== null) {
            if ($this->option('if-missing')) {
                $this->info("Traduction déjà importée : {$existing->translation} ({$existing->verse_count} versets).");

                return self::SUCCESS;
            }

            if (!$this->option('force')) {
                $this->error("La traduction « {$code} » est déjà importée. Relancez avec --force pour la remplacer.");

                return self::FAILURE;
            }
        }

        return $this->import($code, $meta, $json);
    }

    /** @return array<string, mixed>|null */
    private function readMetadata(string $path): ?array
    {
        $metaPath = preg_replace('/\.json$/i', '', $path).'.meta.json';

        if (!is_readable($metaPath)) {
            $this->error("Métadonnées introuvables : {$metaPath}");
            $this->line('Clés exigées : '.implode(', ', [...self::REQUIRED, ...self::NULLABLE]).'.');

            return null;
        }

        $meta = json_decode((string) file_get_contents($metaPath), true);

        if (!is_array($meta)) {
            $this->error("Métadonnées illisibles (JSON invalide) : {$metaPath}");

            return null;
        }

        $missing = [];

        foreach (self::REQUIRED as $key) {
            if (!isset($meta[$key]) || trim((string) $meta[$key]) === '') {
                $missing[] = $key;
            }
        }

        foreach (self::NULLABLE as $key) {
            if (!array_key_exists($key, $meta)) {
                $missing[] = $key;
            }
        }

        if ($missing !== []) {
            $this->error('Métadonnées manquantes : '.implode(', ', $missing).'.');

            return null;
        }

        return $meta;
    }

    /** @param array<string, mixed> $meta @return array<string, mixed>|null */
    private function readBible(string $path, array $meta): ?array
    {
        try {
            $json = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $error) {
            $this->error("Fichier JSON illisible : {$error->getMessage()}");

            return null;
        }

        if (!is_array($json)) {
            $this->error('Fichier JSON invalide : un objet JSON est attendu.');

            return null;
        }

        if (!isset($json['translation'], $json['books']) && ($json['type'] ?? null) === 'database') {
            $json = $this->convertDatabaseExport($json, (string) $meta['translation']);
            if ($json === null) {
                return null;
            }
        }

        if (!isset($json['translation'], $json['books']) || !is_array($json['books'])) {
            $this->error('Fichier JSON invalide : les clés "translation" et "books" sont attendues.');

            return null;
        }

        if ((string) $json['translation'] !== (string) $meta['translation']) {
            $this->error(sprintf(
                'Traduction incohérente : le fichier annonce « %s », les métadonnées « %s ».',
                $json['translation'],
                $meta['translation'],
            ));

            return null;
        }

        return $json;
    }

    /**
     * Convert a JSON export of a Bible SQLite database into the common
     * translation/book/chapter/verse shape consumed by the importer.
     *
     * @param array<string, mixed> $json
     * @param string $translation
     * @return array<string, mixed>|null
     */
    private function convertDatabaseExport(array $json, string $translation): ?array
    {
        $bookRows = $this->databaseTableRows($json, 'books');
        $verseRows = $this->databaseTableRows($json, 'verses');

        if ($bookRows === null || $verseRows === null) {
            $this->error('Export Bible invalide : les tables "books" et "verses" sont requises.');

            return null;
        }

        $booksByNumber = [];
        foreach ($bookRows as $row) {
            if (
                !isset($row['book_number'], $row['long_name'])
                || !is_numeric($row['book_number'])
                || !is_string($row['long_name'])
                || trim($row['long_name']) === ''
            ) {
                $this->error('Export Bible invalide : ligne de livre incorrecte.');

                return null;
            }

            $number = (int) $row['book_number'];
            if (isset($booksByNumber[$number])) {
                $this->error("Export Bible invalide : numéro de livre dupliqué ({$number}).");

                return null;
            }
            $booksByNumber[$number] = [
                'name' => trim($row['long_name']),
                'abbr' => is_string($row['short_name'] ?? null) ? trim($row['short_name']) : '',
                'chapters' => [],
            ];
        }

        if ($booksByNumber === []) {
            $this->error('Export Bible invalide : aucun livre.');

            return null;
        }
        ksort($booksByNumber, SORT_NUMERIC);

        foreach ($verseRows as $row) {
            if (
                !isset($row['book_number'], $row['chapter'], $row['verse'], $row['text'])
                || !is_numeric($row['book_number'])
                || !is_numeric($row['chapter'])
                || !is_numeric($row['verse'])
                || !is_string($row['text'])
                || (int) $row['chapter'] < 1
                || (int) $row['verse'] < 1
            ) {
                $this->error('Export Bible invalide : ligne de verset incorrecte.');

                return null;
            }

            $bookNumber = (int) $row['book_number'];
            if (!isset($booksByNumber[$bookNumber])) {
                $this->error("Export Bible invalide : livre inconnu ({$bookNumber}).");

                return null;
            }

            $chapter = (int) $row['chapter'] - 1;
            $verse = (int) $row['verse'] - 1;
            if (isset($booksByNumber[$bookNumber]['chapters'][$chapter][$verse])) {
                $this->error("Export Bible invalide : verset dupliqué ({$bookNumber}:{$row['chapter']}:{$row['verse']}).");

                return null;
            }

            $text = preg_replace('/<\/?n>/i', '', $row['text']);
            $booksByNumber[$bookNumber]['chapters'][$chapter][$verse] = trim($text ?? $row['text']);
        }

        $books = [];
        foreach ($booksByNumber as $bookNumber => $book) {
            $chapters = $book['chapters'];
            if ($chapters === []) {
                $this->error("Export Bible invalide : aucun verset pour {$book['name']}.");

                return null;
            }
            ksort($chapters, SORT_NUMERIC);

            $orderedChapters = [];
            for ($chapterIndex = 0; $chapterIndex <= max(array_keys($chapters)); $chapterIndex++) {
                $verses = $chapters[$chapterIndex] ?? [];
                if ($verses !== []) {
                    ksort($verses, SORT_NUMERIC);
                    $orderedVerses = [];
                    for ($verseIndex = 0; $verseIndex <= max(array_keys($verses)); $verseIndex++) {
                        $orderedVerses[] = $verses[$verseIndex] ?? '';
                    }
                    $verses = $orderedVerses;
                }
                $orderedChapters[] = $verses;
            }

            $books[] = [
                'name' => $book['name'],
                'abbr' => $book['abbr'],
                'chapters' => $orderedChapters,
            ];
        }

        return ['translation' => $translation, 'books' => $books];
    }

    /**
     * @param array<string, mixed> $json
     * @return list<array<string, mixed>>|null
     */
    private function databaseTableRows(array $json, string $table): ?array
    {
        $objects = $json['objects'] ?? null;
        if (!is_array($objects)) {
            return null;
        }

        foreach ($objects as $object) {
            if (!is_array($object) || ($object['type'] ?? null) !== 'table' || ($object['name'] ?? null) !== $table) {
                continue;
            }

            $columnDefinitions = $object['columns'] ?? null;
            if (!is_array($columnDefinitions)) {
                return null;
            }
            $columns = [];
            foreach ($columnDefinitions as $column) {
                if (!is_array($column) || !isset($column['name'])) {
                    return null;
                }
                $columns[] = (string) $column['name'];
            }
            $rows = $object['rows'] ?? null;
            if ($columns === [] || !is_array($rows)) {
                return null;
            }

            $mappedRows = [];
            foreach ($rows as $row) {
                if (!is_array($row) || count($row) !== count($columns)) {
                    return null;
                }
                $mappedRows[] = array_combine($columns, $row);
            }

            return $mappedRows;
        }

        return null;
    }

    /** @param array<string, mixed> $meta */
    private function resolveCode(string $path, array $meta): string
    {
        if (isset($meta['code']) && trim((string) $meta['code']) !== '') {
            return strtolower(trim((string) $meta['code']));
        }

        $stem = strtolower(preg_replace('/\.json$/i', '', basename($path)) ?? '');
        $stem = preg_replace('/^bible-/', '', $stem);

        return preg_replace('/[^a-z0-9]+/', '-', $stem) ?: 'translation';
    }

    /**
     * @param array<string, mixed> $meta
     * @param array<string, mixed> $json
     */
    private function import(string $code, array $meta, array $json): int
    {
        $started = microtime(true);
        $books = $json['books'];
        $rows = [];
        $count = 0;

        foreach ($books as $bookIndex => $book) {
            if (!is_array($book) || !isset($book['name']) || !isset($book['chapters']) || !is_array($book['chapters'])) {
                $this->error('Fichier JSON invalide : chaque livre doit avoir "name" et "chapters".');

                return self::FAILURE;
            }

            foreach ($book['chapters'] as $chapter => $verses) {
                if (!is_array($verses)) {
                    continue;
                }

                foreach ($verses as $verse => $text) {
                    if (!is_string($text) || trim($text) === '') {
                        continue;
                    }

                    $rows[] = [
                        'book_index' => (int) $bookIndex,
                        'book_name' => (string) $book['name'],
                        'book_abbr' => (string) ($book['abbr'] ?? ''),
                        'chapter' => (int) $chapter,
                        'verse' => ((int) $verse) + 1,
                        'text' => $text,
                    ];
                    $count++;
                }
            }
        }

        if ($count === 0) {
            $this->error('Aucun verset à importer.');

            return self::FAILURE;
        }

        try {
            $bible = DB::transaction(function () use ($code, $meta, $books, $rows, $count): Bible {
                Bible::where('code', $code)->delete();

                $bible = Bible::create([
                    'code' => $code,
                    'translation' => (string) $meta['translation'],
                    'language' => (string) ($meta['language'] ?? 'fr'),
                    'source' => (string) $meta['source'],
                    'edition' => $meta['edition'] !== null ? (string) $meta['edition'] : null,
                    'retrieved_at' => (string) $meta['retrieved_at'],
                    'license' => (string) $meta['license'],
                    'license_url' => $meta['license_url'] !== null ? (string) $meta['license_url'] : null,
                    'book_count' => count($books),
                    'verse_count' => $count,
                ]);

                foreach (array_chunk($rows, self::CHUNK) as $chunk) {
                    BibleVerse::insert(array_map(
                        static fn (array $row): array => $row + ['bible_id' => $bible->id],
                        $chunk,
                    ));
                }

                return $bible;
            }, 3);
        } catch (Throwable $e) {
            $this->error("Échec de l'import : {$e->getMessage()}");

            return self::FAILURE;
        }

        $this->info(sprintf(
            'Importée : %s — %d livres, %d versets, %.1f s.',
            $bible->translation,
            count($books),
            $count,
            microtime(true) - $started,
        ));

        return self::SUCCESS;
    }
}
