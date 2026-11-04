<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * One imported Bible translation, with the provenance/licence metadata that
 * the cadrage requires before any text is shipped (docs/phase-1-cadrage.md §3.1).
 */
class Bible extends Model
{
    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'code',
        'translation',
        'language',
        'source',
        'edition',
        'retrieved_at',
        'license',
        'license_url',
        'verse_count',
        'book_count',
    ];

    protected function casts(): array
    {
        return [
            'retrieved_at' => 'date:Y-m-d',
            'verse_count' => 'integer',
            'book_count' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Bible $bible): void {
            $bible->id ??= (string) Str::uuid();
        });
    }

    public function verses(): HasMany
    {
        return $this->hasMany(BibleVerse::class);
    }

    /** Shape returned by the API: everything a client needs to display the licence. */
    public function toApiArray(): array
    {
        return [
            'code' => $this->code,
            'translation' => $this->translation,
            'language' => $this->language,
            'source' => $this->source,
            'edition' => $this->edition,
            'retrieved_at' => $this->retrieved_at?->toDateString(),
            'license' => $this->license,
            'license_url' => $this->license_url,
            'verse_count' => $this->verse_count,
            'book_count' => $this->book_count,
        ];
    }
}
