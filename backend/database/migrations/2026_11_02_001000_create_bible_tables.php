<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One row per imported translation, with the provenance and licence
        // metadata required by the cadrage (docs/phase-1-cadrage.md §3.1).
        Schema::create('bibles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('code', 32)->unique();
            $table->string('translation');
            $table->string('language', 16)->default('fr');
            $table->string('source');
            $table->string('edition')->nullable();
            $table->date('retrieved_at');
            $table->string('license');
            $table->string('license_url')->nullable();
            $table->unsignedInteger('verse_count')->default(0);
            $table->unsignedSmallInteger('book_count')->default(0);
            $table->timestamps();
        });

        Schema::create('bible_verses', function (Blueprint $table) {
            $table->increments('id');
            $table->foreignUuid('bible_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('book_index');
            $table->string('book_name');
            $table->string('book_abbr', 32);
            $table->unsignedSmallInteger('chapter');
            $table->unsignedSmallInteger('verse');
            $table->text('text');

            $table->index(['bible_id', 'book_index', 'chapter'], 'bible_verses_lookup');
        });

        // Full-text search (FTS5) over the verse text. External-content table:
        // only the index lives in FTS, the text stays in `bible_verses`.
        // `remove_diacritics 1` makes "dieu" match "Dieu" and "amer" match "amère".
        DB::statement(
            "CREATE VIRTUAL TABLE bible_verses_fts USING fts5(text, content='bible_verses', content_rowid='id', tokenize='unicode61 remove_diacritics 1')"
        );
        DB::statement(<<<'SQL'
            CREATE TRIGGER bible_verses_ai AFTER INSERT ON bible_verses BEGIN
                INSERT INTO bible_verses_fts(rowid, text) VALUES (new.id, new.text);
            END;
        SQL);
        DB::statement(<<<'SQL'
            CREATE TRIGGER bible_verses_ad AFTER DELETE ON bible_verses BEGIN
                INSERT INTO bible_verses_fts(bible_verses_fts, rowid, text) VALUES ('delete', old.id, old.text);
            END;
        SQL);
        DB::statement(<<<'SQL'
            CREATE TRIGGER bible_verses_au AFTER UPDATE ON bible_verses BEGIN
                INSERT INTO bible_verses_fts(bible_verses_fts, rowid, text) VALUES ('delete', old.id, old.text);
                INSERT INTO bible_verses_fts(rowid, text) VALUES (new.id, new.text);
            END;
        SQL);
    }

    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS bible_verses_au');
        DB::statement('DROP TRIGGER IF EXISTS bible_verses_ad');
        DB::statement('DROP TRIGGER IF EXISTS bible_verses_ai');
        DB::statement('DROP TABLE IF EXISTS bible_verses_fts');
        Schema::dropIfExists('bible_verses');
        Schema::dropIfExists('bibles');
    }
};
