// Crea la clave de firma del APK de publicación (una sola vez) y android/keystore.properties.
//
// La clave se guarda FUERA del repositorio (por defecto en ~/.lix-android/) con una contraseña
// aleatoria; keystore.properties está ignorado por git. Haz copia de seguridad de los dos
// archivos: sin esa clave, Android no deja instalar versiones nuevas encima de la anterior.
//
// Uso: npm run android:keystore            (LIX_KEYSTORE_DIR=otra/carpeta para cambiar el destino)
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const propsFile = path.resolve('android', 'keystore.properties');
if (existsSync(propsFile)) {
  console.log(`Ya existe ${propsFile}: no se crea otra clave (cambiarla impediría actualizar la app instalada).`);
  process.exit(0);
}

const dir = path.resolve(process.env.LIX_KEYSTORE_DIR ?? path.join(homedir(), '.lix-android'));
const storeFile = path.join(dir, 'lix-release.jks');
if (existsSync(storeFile)) {
  console.error(`Ya existe ${storeFile} pero falta android/keystore.properties. Recréalo a mano con sus datos (ver README).`);
  process.exit(1);
}
mkdirSync(dir, { recursive: true });

const password = randomBytes(24).toString('base64url');
const alias = 'lix';
const keytool = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', 'keytool') : 'keytool';
const result = spawnSync(
  keytool,
  ['-genkeypair', '-keystore', storeFile, '-storetype', 'PKCS12', '-alias', alias, '-keyalg', 'RSA', '-keysize', '4096',
    '-validity', '10000', '-storepass', password, '-keypass', password, '-dname', 'CN=Lix'],
  { stdio: ['ignore', 'inherit', 'inherit'] },
);
if (result.status !== 0) {
  console.error('keytool falló. ¿Está instalado un JDK (17 o superior) y en el PATH o en JAVA_HOME?');
  process.exit(result.status ?? 1);
}

writeFileSync(
  propsFile,
  [
    '# Firma del APK de publicación. NO subir a git (está en android/.gitignore).',
    `storeFile=${storeFile.replaceAll('\\', '/')}`,
    `storePassword=${password}`,
    `keyAlias=${alias}`,
    `keyPassword=${password}`,
    '',
  ].join('\n'),
);
console.log(`\nClave creada: ${storeFile}\nConfiguración: ${propsFile}`);
console.log('IMPORTANTE: guarda una copia de ambos archivos en un lugar seguro (p. ej. tu gestor de contraseñas).');
