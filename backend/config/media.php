<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Media library (phase 7) — images and videos projected during a service
    |--------------------------------------------------------------------------
    |
    | The library lives with the other user data, outside the install
    | directory (phase 1, §4): Electron sets CHURCH_DATA_DIR and the media
    | folder is <data>/media. CHURCH_MEDIA_DIR overrides it explicitly.
    | Without either (plain dev/tests) the files go to storage/app/media.
    |
    */

    'dir' => env(
        'CHURCH_MEDIA_DIR',
        env('CHURCH_DATA_DIR')
            ? rtrim(env('CHURCH_DATA_DIR'), '/\\').DIRECTORY_SEPARATOR.'media'
            : storage_path('app/media'),
    ),

    // Upload ceiling: a projected video is a few dozen MB at most.
    'max_kilobytes' => (int) env('CHURCH_MEDIA_MAX_KB', 300 * 1024),

    'image_extensions' => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'],
    'video_extensions' => ['mp4', 'webm', 'ogv'],
];
