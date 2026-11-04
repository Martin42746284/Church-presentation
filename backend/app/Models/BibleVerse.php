<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A single verse. Book/chapter/verse are 0-indexed / 1-indexed in storage. */
class BibleVerse extends Model
{
    public $timestamps = false;

    protected $fillable = ['bible_id', 'book_index', 'book_name', 'book_abbr', 'chapter', 'verse', 'text'];

    protected function casts(): array
    {
        return [
            'book_index' => 'integer',
            'chapter' => 'integer',
            'verse' => 'integer',
        ];
    }

    public function bible(): BelongsTo
    {
        return $this->belongsTo(Bible::class);
    }
}
