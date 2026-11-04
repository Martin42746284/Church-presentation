<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Song extends Model
{
    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'title',
        'author',
        'lang',
        'category',
        'collection',
        'lyrics',
    ];

    protected static function booted(): void
    {
        static::creating(function (Song $song): void {
            $song->id ??= (string) Str::uuid();
        });
    }

    /** Program items referencing this song (used to protect songs in use). */
    public function programItems(): HasMany
    {
        return $this->hasMany(ProgramItem::class);
    }
}
