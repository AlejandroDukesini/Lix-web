/**
 * Guardado de creaciones del taller (animaciones de Lix Flowers, imágenes de AI Studio).
 *
 * El archivo va al store `attachments` (ArrayBuffer, ≤ 3 MB) y el registro `creation`
 * al almacén de la organización: así entran solos en las copias de seguridad, en el
 * borrado con integridad y en la limpieza de huérfanos.
 */
import { MAX_ATTACHMENT_BYTES, saveAttachment } from '../../organizer/data/attachments.js';
import { createRecord } from '../../organizer/data/store.js';

export function slugify(text, fallback = 'creacion') {
  const slug = String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || fallback;
}

const EXTENSIONS = { 'image/gif': 'gif', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

/** Guarda `blob` y crea el registro. Devuelve el registro creado. */
export async function saveCreation(blob, { origin, title, prompt = '', provider = '', params = null, width = 0, height = 0 }) {
  if (!blob || !blob.size) throw new Error('No hay nada que guardar todavía.');
  if (blob.size > MAX_ATTACHMENT_BYTES) throw new Error('El archivo pesa más de 3 MB. Reduce el tamaño o los fotogramas y vuelve a intentarlo.');
  const ext = EXTENSIONS[blob.type] ?? 'bin';
  const file = new File([blob], `${slugify(title)}.${ext}`, { type: blob.type });
  const attachment = await saveAttachment(file);
  return createRecord('creation', {
    origin,
    title: String(title || 'Sin título').slice(0, 120),
    prompt: String(prompt).slice(0, 1000),
    provider: String(provider).slice(0, 80),
    params: params ? JSON.stringify(params).slice(0, 4000) : '',
    width,
    height,
    attachmentIds: [attachment.id],
  });
}

/** Descarga un Blob con un nombre de archivo (sin servidor). */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
