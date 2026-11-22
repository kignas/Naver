import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const RES = path.resolve('android/app/src/main/res/mipmap-anydpi-v26');

// Android adaptive icons are 108dp with a 72dp safe zone. Keep the background
// full-bleed and inset only the foreground so the mark stays inside the mask.
const xml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground>
        <inset android:drawable="@mipmap/ic_launcher_foreground" android:inset="16.7%" />
    </foreground>
</adaptive-icon>
`;

for (const file of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
  await writeFile(path.join(RES, file), xml);
}

console.log('Patched adaptive icon XML');
