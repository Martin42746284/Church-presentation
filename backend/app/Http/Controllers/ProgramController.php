<?php

namespace App\Http\Controllers;

use App\Models\Program;
use App\Models\ProgramItem;
use App\Models\Song;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ProgramController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Program::query()->with('items.song')->orderByDesc('date');

        // `?archived=only` lists the archive, `?archived=1` lists everything,
        // the default (workspace view) hides archived programs.
        $archived = $request->query('archived');

        if ($archived === 'only') {
            $query->whereNotNull('archived_at');
        } elseif (!$request->boolean('archived')) {
            $query->whereNull('archived_at');
        }

        if ($search = trim((string) $request->query('q', ''))) {
            $query->where('name', 'like', "%{$search}%");
        }

        return response()->json(['data' => $query->get()]);
    }

    public function show(Program $program): JsonResponse
    {
        $program->load('items.song');

        return response()->json(['data' => $program]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'date' => ['required', 'date'],
            'items' => ['sometimes', 'array'],
            'items.*.kind' => ['required', 'in:'.implode(',', ProgramItem::KINDS)],
            'items.*.song_id' => ['nullable', 'uuid', 'exists:songs,id'],
            'items.*.title' => ['nullable', 'string', 'max:255'],
            'items.*.body' => ['nullable', 'string'],
            'items.*.payload' => ['nullable', 'array'],
        ]);

        $program = DB::transaction(function () use ($validated): Program {
            $program = Program::create([
                'name' => $validated['name'],
                'date' => $validated['date'],
            ]);

            $this->replaceItems($program, $validated['items'] ?? []);

            return $program->load('items.song');
        }, 3);

        return response()->json(['data' => $program], 201);
    }

    public function update(Request $request, Program $program): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'date' => ['sometimes', 'required', 'date'],
            // When present, `items` is the whole ordered list: it replaces the
            // stored one (the workspace saves the program after every change).
            'items' => ['sometimes', 'array'],
            'items.*.kind' => ['required', 'in:'.implode(',', ProgramItem::KINDS)],
            'items.*.song_id' => ['nullable', 'uuid', 'exists:songs,id'],
            'items.*.title' => ['nullable', 'string', 'max:255'],
            'items.*.body' => ['nullable', 'string'],
            'items.*.payload' => ['nullable', 'array'],
        ]);

        $program = DB::transaction(function () use ($validated, $program): Program {
            $attributes = array_intersect_key($validated, array_flip(['name', 'date']));
            if ($attributes !== []) {
                $program->update($attributes);
            }

            if (array_key_exists('items', $validated)) {
                $this->replaceItems($program, $validated['items']);
            }

            return $program->load('items.song');
        }, 3);

        return response()->json(['data' => $program]);
    }

    /** Copy a program with its ordered items and their content snapshots. */
    public function duplicate(Program $program): JsonResponse
    {
        $copy = DB::transaction(function () use ($program): Program {
            $copy = Program::create([
                'name' => $program->name.' (copie)',
                'date' => $program->date->toDateString(),
            ]);

            // Passing the stored snapshot keeps the copy byte-for-byte faithful
            // to the original instead of re-reading the songs.
            $this->replaceItems($copy, $program->items
                ->sortBy('position')
                ->map(static fn (ProgramItem $item): array => [
                    'kind' => $item->kind,
                    'song_id' => $item->song_id,
                    'title' => $item->title,
                    'body' => $item->body,
                    'payload' => $item->payload,
                    'snapshot' => $item->snapshot,
                ])
                ->all());

            return $copy->load('items.song');
        }, 3);

        return response()->json(['data' => $copy], 201);
    }

    public function archive(Program $program): JsonResponse
    {
        $program->update(['archived_at' => now()]);

        return response()->json(['data' => $program]);
    }

    public function restore(Program $program): JsonResponse
    {
        $program->update(['archived_at' => null]);

        return response()->json(['data' => $program]);
    }

    /**
     * Wipe and recreate the ordered item list of a program, filling the content
     * snapshot of every song/verse item (phase 6: past programs keep the text
     * they were built with).
     */
    private function replaceItems(Program $program, array $items): void
    {
        $program->items()->delete();

        $items = array_values($items);
        $songs = $this->prefetchSongs($items);

        foreach ($items as $position => $item) {
            $program->items()->create([
                'position' => $position,
                'kind' => $item['kind'],
                'song_id' => $item['song_id'] ?? null,
                'title' => $item['title'] ?? null,
                'body' => $item['body'] ?? null,
                'payload' => $item['payload'] ?? null,
                'snapshot' => $this->snapshotFor($item, $songs),
            ]);
        }
    }

    /** @return Collection<string, Song> */
    private function prefetchSongs(array $items): Collection
    {
        $ids = array_values(array_unique(array_filter(array_column($items, 'song_id'))));

        if ($ids === []) {
            return collect();
        }

        return Song::whereIn('id', $ids)->get()->keyBy('id');
    }

    /** @param Collection<string, Song> $songs @return array<string, mixed>|null */
    private function snapshotFor(array $item, Collection $songs): ?array
    {
        // A client that already carries the snapshot (program duplication)
        // keeps it untouched.
        if (array_key_exists('snapshot', $item)) {
            return $item['snapshot'];
        }

        if (($item['kind'] ?? null) === 'song') {
            $song = ($item['song_id'] ?? null) ? $songs->get($item['song_id']) : null;

            if ($song === null) {
                return null;
            }

            return [
                'title' => $song->title,
                'author' => $song->author,
                'lang' => $song->lang,
                'lyrics' => $song->lyrics,
            ];
        }

        if (($item['kind'] ?? null) === 'verse') {
            $payload = is_array($item['payload'] ?? null) ? $item['payload'] : [];
            $verses = is_array($payload['verses'] ?? null) ? $payload['verses'] : [];

            if ($verses === []) {
                return null;
            }

            return [
                'ref' => (string) ($payload['ref'] ?? $item['title'] ?? ''),
                'translation' => isset($payload['translation']) ? (string) $payload['translation'] : null,
                'verses' => array_values(array_map(static fn (array $verse): array => [
                    'label' => (string) ($verse['label'] ?? ''),
                    'text' => (string) ($verse['text'] ?? ''),
                ], $verses)),
            ];
        }

        // `text` items already store their content inline.
        return null;
    }

    public function destroy(Program $program): Response
    {
        $program->delete();

        return response()->noContent();
    }
}
