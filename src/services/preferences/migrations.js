/**
 * Migraciones del esquema de preferencias guardado en localStorage.
 *
 * Cada entrada transforma los datos de la versión N a la N+1. Al cargar, se
 * aplican en orden todas las pendientes y después `sanitizePreferences`
 * completa o repara lo que falte. Para cambiar la forma de los datos:
 *   1. Sube PREFERENCES_SCHEMA_VERSION en defaults.js.
 *   2. Añade aquí la función que convierte la versión anterior en la nueva.
 *   3. Añade una prueba en preferences.test.js con datos de la versión anterior.
 */
import { PREFERENCES_SCHEMA_VERSION } from './defaults.js';
import { isPlainObject } from './validation.js';

/** Mensaje de celebración predeterminado de la v1, para saber si la persona lo había personalizado. */
const V1_DEFAULT_TOGETHER_MESSAGE =
  'Que este nuevo año nos regale más momentos, más risas, más aventuras y muchos recuerdos que todavía nos quedan por construir.';

export const PREFERENCE_MIGRATIONS = {
  // 0 → 1: datos sin `schemaVersion` (prototipos previos). La forma es la misma,
  // solo se marca la versión; el saneamiento se ocupa de cualquier campo inválido.
  0: (data) => ({ ...data, schemaVersion: 1 }),

  // 1 → 2: la presentación de la vela se convierte en el viaje astral.
  //  - Se conservan la firma y el título «Otro año juntos» (existen en ambos esquemas).
  //  - Un mensaje de celebración personalizado pasa a ser el mensaje final.
  //  - Los textos de escenas que ya no existen (bienvenida, deseo, entrada) se retiran.
  //  - El estado «completada» y el resto de preferencias no se tocan.
  1: (data) => {
    const presentation = isPlainObject(data.presentation) ? data.presentation : {};
    const old = isPlainObject(presentation.texts) ? presentation.texts : {};
    const texts = {};
    if (typeof old.signature === 'string') texts.signature = old.signature;
    if (typeof old.togetherTitle === 'string') texts.togetherTitle = old.togetherTitle;
    if (typeof old.togetherMessage === 'string' && old.togetherMessage.trim() !== V1_DEFAULT_TOGETHER_MESSAGE) {
      texts.finalMessage = old.togetherMessage;
    }
    return { ...data, schemaVersion: 2, presentation: { ...presentation, texts } };
  },
};

export function migratePreferences(data) {
  if (!isPlainObject(data)) return { data, migrated: false, fromVersion: null };

  const fromVersion = Number.isInteger(data.schemaVersion) ? data.schemaVersion : 0;
  if (fromVersion > PREFERENCES_SCHEMA_VERSION) {
    // Datos de una versión más nueva de la app: se conservan los campos conocidos.
    return { data, migrated: false, fromVersion, newer: true };
  }

  let current = data;
  for (let version = fromVersion; version < PREFERENCES_SCHEMA_VERSION; version += 1) {
    const migrate = PREFERENCE_MIGRATIONS[version];
    if (!migrate) throw new Error(`Falta la migración de preferencias ${version} → ${version + 1}`);
    current = migrate(current);
  }
  return { data: current, migrated: fromVersion !== PREFERENCES_SCHEMA_VERSION, fromVersion };
}
