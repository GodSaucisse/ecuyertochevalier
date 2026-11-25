// Sauvegarde automatique dans le navigateur (localStorage).
// La partie est liée au navigateur et à l'appareil utilisés.
const KEY = 'ecuyer-a-chevalier:sauvegarde:v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data.step === 'number' ? data : null;
  } catch (_) {
    return null;
  }
}

export function writeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
    return true;
  } catch (_) {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (_) { /* rien */ }
}
