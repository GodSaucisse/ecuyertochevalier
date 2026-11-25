// Réglages du joueur, gardés dans le navigateur.
const KEY = 'ecuyer-a-chevalier:reglages:v1';
const DEFAULTS = { music: 0.5, sfx: 0.8, sens: 1, quality: 'auto' };

export function loadSettings() {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY)) || {}) };
  } catch (_) {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) { /* rien */ }
}
