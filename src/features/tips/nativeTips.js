/**
 * Consejos mostrados por Android con la app cerrada → historial de la app.
 * Se marca su franja como mostrada para que la app no repita el mismo consejo dentro.
 */
import { consumeDeliveredTips, isAndroidShell } from '../../services/native/androidBridge.js';
import { ensureLoaded, getSettings, saveSettings } from '../organizer/data/store.js';
import { appendHistory } from './tipsLogic.js';

export async function mergeDeliveredTips() {
  if (!isAndroidShell()) return 0;
  const delivered = consumeDeliveredTips().filter((d) => d && typeof d.tipId === 'string' && typeof d.shownAt === 'string');
  if (!delivered.length) return 0;
  await ensureLoaded();
  const state = getSettings('tipState');
  let history = state.history;
  for (const item of delivered) history = appendHistory(history, { tipId: item.tipId, shownAt: item.shownAt, channel: 'android' });
  await saveSettings('tipState', { history, lastSlot: String(delivered.at(-1).key ?? state.lastSlot).slice(0, 40) });
  return delivered.length;
}
