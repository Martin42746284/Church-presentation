<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('programs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->date('date');
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();

            $table->index('date');
        });

        Schema::create('program_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('program_id');
            $table->unsignedInteger('position');
            // song | text | verse | media | announcement (extended in later phases)
            $table->string('kind', 32);
            $table->uuid('song_id')->nullable();
            $table->string('title')->nullable();
            $table->text('body')->nullable();
            $table->json('payload')->nullable();
            $table->timestamps();

            $table->foreign('program_id')->references('id')->on('programs')->cascadeOnDelete();
            $table->foreign('song_id')->references('id')->on('songs')->nullOnDelete();
            $table->unique(['program_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('program_items');
        Schema::dropIfExists('programs');
    }
};
