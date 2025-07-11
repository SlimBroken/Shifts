// lock.js
export function lockPreferences() {
  localStorage.setItem('preferencesLocked', 'true');
  localStorage.setItem('lockTimestamp', Date.now().toString());
}

export function unlockPreferences() {
  localStorage.setItem('preferencesLocked', 'false');
  localStorage.removeItem('lockTimestamp');
}
