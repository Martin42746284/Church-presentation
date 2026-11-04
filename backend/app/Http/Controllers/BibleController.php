<?php

namespace App\Http\Controllers;

use App\Models\Bible;
use App\Models\BibleVerse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Bible navigation, chapter lookup and FTS5 full-text search (phase 6).
 *
 * The database is the single source of truth for the desktop app: the JSON
 * shipped with the project is only the import input.
 */
class BibleController extends Controller
{
    private const SEARCH_LIMIT = 60;

    /** Translations available, with their licence metadata. */
    public function index(): JsonResponse
    {
        $data = Bible::orderBy('translation')->get()->map(fn (Bible $bible): array => $bible->toApiArray());

        return response()->json(['data' => $data]);
    }

    /** Books of a translation, with chapter/verse counts for the selectors. */
    public function books(Request $request): JsonResponse
    {
        $bible = $this->resolve($request);

        if ($bible === null) {
            return $this->missingTranslation();
        }

        $books = BibleVerse::where('bible_id', $bible->id)
            ->selectRaw('book_index, book_name, book_abbr, max(chapter) as chapters, count(*) as verses')
            ->groupBy('book_index', 'book_name', 'book_abbr')
            ->orderBy('book_index')
            ->get()
            ->map(static fn (BibleVerse $row): array => [
                'index' => $row->book_index,
                'name' => $row->book_name,
                'abbr' => $row->book_abbr,
                // Stored 0-indexed: expose a human 1-based chapter count.
                'chapters' => $row->chapters + 1,
                'verses' => $row->verses,
            ]);

        return response()->json([
            'translation' => $bible->translation,
            'license' => $bible->license,
            'data' => $books,
        ]);
    }

    /** Verses of one chapter (1-based in, 1-based out). */
    public function chapter(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'translation' => ['sometimes', 'string'],
            'book' => ['required', 'integer', 'min:0'],
            'chapter' => ['required', 'integer', 'min:1'],
        ]);

        $bible = $this->resolve($request);

        if ($bible === null) {
            return $this->missingTranslation();
        }

        $verses = BibleVerse::where('bible_id', $bible->id)
            ->where('book_index', $validated['book'])
            ->where('chapter', $validated['chapter'] - 1)
            ->orderBy('verse')
            ->get(['book_name', 'book_abbr', 'verse', 'text']);

        if ($verses->isEmpty()) {
            return response()->json(['message' => 'Chapitre introuvable.'], 404);
        }

        return response()->json([
            'translation' => $bible->translation,
            'license' => $bible->license,
            'book' => [
                'index' => (int) $validated['book'],
                'name' => $verses->first()->book_name,
                'abbr' => $verses->first()->book_abbr,
            ],
            'chapter' => (int) $validated['chapter'],
            'data' => $verses->map(static fn (BibleVerse $verse): array => [
                'n' => $verse->verse,
                'text' => $verse->text,
            ]),
        ]);
    }

    /** FTS5 full-text search, incremental-friendly (prefix on the last word). */
    public function search(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'translation' => ['sometimes', 'string'],
            'q' => ['required', 'string'],
        ]);

        $bible = $this->resolve($request);

        if ($bible === null) {
            return $this->missingTranslation();
        }

        // Two characters minimum: a single letter is too noisy to be useful.
        if (mb_strlen(trim($validated['q'])) < 2) {
            return response()->json(['translation' => $bible->translation, 'data' => []]);
        }

        $match = $this->matchQuery($validated['q']);

        if ($match === '') {
            return response()->json(['data' => []]);
        }

        $rows = DB::select(
            'SELECT v.book_index, v.book_name, v.chapter, v.verse, v.text
             FROM bible_verses_fts
             JOIN bible_verses v ON v.id = bible_verses_fts.rowid
             WHERE bible_verses_fts MATCH ? AND v.bible_id = ?
             ORDER BY rank
             LIMIT '.self::SEARCH_LIMIT,
            [$match, $bible->id],
        );

        return response()->json([
            'translation' => $bible->translation,
            'query' => $validated['q'],
            'data' => array_map(static fn (object $row): array => [
                'book' => (int) $row->book_index,
                'book_name' => $row->book_name,
                // Stored 0-indexed → expose the chapter the way it is printed.
                'chapter' => ((int) $row->chapter) + 1,
                'verse' => (int) $row->verse,
                'ref' => sprintf('%s %d:%d', $row->book_name, ((int) $row->chapter) + 1, (int) $row->verse),
                'text' => $row->text,
            ], $rows),
        ]);
    }

    private function resolve(Request $request): ?Bible
    {
        $code = trim((string) $request->query('translation', ''));

        if ($code !== '') {
            return Bible::where('code', $code)->first();
        }

        return Bible::orderBy('code')->first();
    }

    private function missingTranslation(): JsonResponse
    {
        return response()->json(['message' => 'Aucune traduction importée.'], 404);
    }

    /**
     * Turn free text into an FTS5 expression: quoted words joined by AND, with
     * a prefix match on the last word so results update while typing.
     */
    private function matchQuery(string $query): string
    {
        $tokens = preg_split('/[^\p{L}\p{N}]+/u', $query, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $tokens = array_slice($tokens, 0, 12);

        if ($tokens === []) {
            return '';
        }

        $last = count($tokens) - 1;
        $parts = [];

        foreach ($tokens as $index => $token) {
            $escaped = str_replace('"', '""', $token);
            $parts[] = '"'.$escaped.'"'.($index === $last ? '*' : '');
        }

        return implode(' AND ', $parts);
    }
}
