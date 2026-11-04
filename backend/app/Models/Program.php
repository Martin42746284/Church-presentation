<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Program extends Model
{
    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = ['name', 'date', 'archived_at'];

    protected function casts(): array
    {
        return [
            'date' => 'date:Y-m-d',
            'archived_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Program $program): void {
            $program->id ??= (string) Str::uuid();
        });
    }

    public function items(): HasMany
    {
        return $this->hasMany(ProgramItem::class)->orderBy('position');
    }

    public function activeItems(): HasMany
    {
        return $this->items();
    }
}
