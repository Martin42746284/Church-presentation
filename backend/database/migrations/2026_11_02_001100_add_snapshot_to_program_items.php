<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Content snapshot of the item at the time the program was saved, so a
     * program keeps projecting the text it was built with even when the song
     * is edited or deleted later (phase 6).
     */
    public function up(): void
    {
        Schema::table('program_items', function (Blueprint $table) {
            $table->json('snapshot')->nullable()->after('payload');
        });
    }

    public function down(): void
    {
        Schema::table('program_items', function (Blueprint $table) {
            $table->dropColumn('snapshot');
        });
    }
};
