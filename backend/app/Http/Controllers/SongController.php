<?php

namespace App\Http\Controllers;

use App\Models\Song;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class SongController extends Controller
{
    /** Instant search/filter: q, lang, category, collection, sort. */
    public function index(Request $request): JsonResponse
    {
        $query = Song::query();

        $q = trim((string) $request->query('q', ''));
        if ($q !== '') {
            $query->where(function ($builder) use ($q): void {
                $builder->where('title', 'like', "%{$q}%")
                    ->orWhere('author', 'like', "%{$q}%")
                    ->orWhere('lyrics', 'like', "%{$q}%");
            });
        }

        foreach (['lang', 'category', 'collection'] as $field) {
            if ($value = $request->query($field)) {
                $query->where($field, $value);
            }
        }

        $sort = in_array($request->query('sort'), ['title', 'created_at'], true)
            ? $request->query('sort')
            : 'title';
        $query->orderBy($sort);

        return response()->json(['data' => $query->get()]);
    }

    public function show(Song $song): JsonResponse
    {
        return response()->json(['data' => $song]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'author' => ['nullable', 'string', 'max:255'],
            'lang' => ['nullable', 'string', 'max:16'],
            'category' => ['nullable', 'string', 'max:255'],
            'collection' => ['nullable', 'string', 'max:255'],
            'lyrics' => ['required', 'string'],
        ]);

        $song = Song::create($validated);

        return response()->json(['data' => $song], 201);
    }

    public function update(Request $request, Song $song): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'author' => ['nullable', 'string', 'max:255'],
            'lang' => ['nullable', 'string', 'max:16'],
            'category' => ['nullable', 'string', 'max:255'],
            'collection' => ['nullable', 'string', 'max:255'],
            'lyrics' => ['sometimes', 'required', 'string'],
        ]);

        $song->update($validated);

        return response()->json(['data' => $song]);
    }

    /** Number of programs referencing this song (protect songs in use). */
    public function usage(Song $song): JsonResponse
    {
        return response()->json([
            'song_id' => $song->id,
            'program_items' => $song->programItems()->count(),
        ]);
    }

    /**
     * Delete a song. Songs referenced by a program are protected: the client
     * must remove them from every program first (409 + the usage count).
     */
    public function destroy(Song $song): Response|JsonResponse
    {
        $used = $song->programItems()->count();

        if ($used > 0) {
            return response()->json([
                'message' => 'Ce chant est utilisé dans un programme.',
                'program_items' => $used,
            ], 409);
        }

        $song->delete();

        return response()->noContent();
    }
}
