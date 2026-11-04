<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Key/value application settings (panel layout, display choice, themes...). */
class Setting extends Model
{
    public $incrementing = false;

    protected $primaryKey = 'key';

    protected $keyType = 'string';

    protected $fillable = ['key', 'value'];

    protected function casts(): array
    {
        return ['value' => 'array'];
    }
}
