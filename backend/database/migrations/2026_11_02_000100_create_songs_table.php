<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('songs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->string('author')->nullable();
            $table->string('lang', 16)->default('fr');
            $table->string('category')->nullable();
            $table->string('collection')->nullable();
            $table->text('lyrics');
            $table->timestamps();

            $table->index(['lang', 'category']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('songs');
    }
};
