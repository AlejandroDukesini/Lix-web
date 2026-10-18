/**
 * Archivos adjuntos (comprobantes de gastos, fotos del diario).
 *
 * Se guardan en el store `attachments` de IndexedDB como ArrayBuffer + tipo (más
 * fiable que un Blob al clonar y al copiar entre navegadores). El registro dueño
 * guarda solo los ids en `attachmentIds`. Si el registro se borra, sus adjuntos se
 * borran en la misma transacción (store.js); los que quedan sin dueño más de un día
 * (p. ej. un formulario cancelado) se limpian al abrir la app.
 *
 * Límites para no llenar el almacenamiento del navegador: 3 MB por archivo, solo
 * imágenes y PDF. Sin IndexedDB no se pueden adjuntar archivos.
 */
import { dbGet, dbKeys, dbWriteMany, isIndexedDBAvailable, STORES } from '../../../services/storage/database.js';
import { getStatus, newId } from './store.js';
import { isValidDateTime, isValidId } from './fields.js';

export const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
export const ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

export async function saveAttachment(file) {
  if (!isIndexedDBAvailable() || !getStatus().persistent) throw new Error('Este navegador no permite guardar archivos.');
  if (!ATTACHMENT_TYPES.includes(file.type)) throw new Error('Solo se pueden adjuntar imágenes (JPG, PNG, WebP, GIF) o PDF.');
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error('El archivo pesa más de 3 MB. Prueba con una foto más pequeña.');
  const data = await file.arrayBuffer();
  const record = { id: newId(), name: String(file.name || 'archivo').slice(0, 120), type: file.type, size: file.size, createdAt: new Date().toISOString(), data };
  await dbWriteMany([{ store: STORES.attachments, key: record.id, value: record }]);
  return { id: record.id, name: record.name, type: record.type, size: record.size };
}

export async function readAttachment(id) {
  if (!isValidId(id) || !isIndexedDBAvailable()) return null;
  return (await dbGet(STORES.attachments, id).catch(() => null)) ?? null;
}

/* ---------- Copias de seguridad ---------- */

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function fromBase64(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function exportAttachments() {
  if (!isIndexedDBAvailable()) return { files: [] };
  try {
    const keys = await dbKeys(STORES.attachments);
    const files = [];
    for (const key of keys) {
      const item = await dbGet(STORES.attachments, key);
      if (item?.data) files.push({ id: item.id, name: item.name, type: item.type, size: item.size, createdAt: item.createdAt, data: toBase64(item.data) });
    }
    return { files };
  } catch {
    return { files: [] };
  }
}

export function sanitizeAttachments(raw) {
  if (!raw || !Array.isArray(raw.files)) return { value: null, issues: ['attachments'] };
  const files = [];
  let problems = 0;
  for (const file of raw.files) {
    const ok =
      file &&
      isValidId(file.id) &&
      ATTACHMENT_TYPES.includes(file.type) &&
      typeof file.data === 'string' &&
      file.data.length <= Math.ceil((MAX_ATTACHMENT_BYTES * 4) / 3) + 8 &&
      /^[A-Za-z0-9+/=]*$/.test(file.data);
    if (!ok) {
      problems += 1;
      continue;
    }
    files.push({
      id: file.id,
      name: typeof file.name === 'string' ? file.name.slice(0, 120) : 'archivo',
      type: file.type,
      size: Number.isInteger(file.size) ? file.size : 0,
      createdAt: isValidDateTime(file.createdAt) ? file.createdAt : new Date().toISOString(),
      data: file.data,
    });
  }
  return { value: { files }, issues: problems ? ['attachments'] : [] };
}

/** Añade (o reemplaza por id) los adjuntos de la copia. Nunca borra los existentes. */
export async function restoreAttachments(value) {
  if (!isIndexedDBAvailable() || !value.files.length) return;
  const ops = value.files.map((file) => ({ store: STORES.attachments, key: file.id, value: { ...file, data: fromBase64(file.data) } }));
  for (let i = 0; i < ops.length; i += 20) await dbWriteMany(ops.slice(i, i + 20));
}
