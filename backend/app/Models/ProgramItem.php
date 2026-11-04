<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class ProgramItem extends Model
{
    public const KINDS = ['song', 'text', 'verse', 'media', 'announcement'];

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = ['program_id', 'position', 'kind', 'song_id', 'title', 'body', 'payload', 'snapshot'];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'snapshot' => 'array',
            'position' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (ProgramItem $item): void {
            $item->id ??= (string) Str::uuid();
        });
    }

    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class);
    }

    public function song(): BelongsTo
    {
        return $this->belongsTo(Song::class);
    }
}
