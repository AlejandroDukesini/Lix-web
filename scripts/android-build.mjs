// Compila la app Android (android/) con el wrapper de Gradle. El build web (dist/) debe existir:
// la tarea syncWebAssets lo copia dentro del APK. Uso: node scripts/android-build.mjs assembleDebug
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const task = process.argv[2] ?? 'assembleDebug';
const cwd = path.resolve('android');
const gradlew = process.platform === 'win32' ? `"${path.join(cwd, 'gradlew.bat')}"` : './gradlew';
const result = spawnSync(gradlew, [task, '--console=plain'], { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
if (result.status === 0) {
  const type = task.toLowerCase().includes('release') ? 'release' : 'debug';
  console.log(`\nAPK: android/app/build/outputs/apk/${type}/app-${type}.apk`);
}
process.exit(result.status ?? 1);
