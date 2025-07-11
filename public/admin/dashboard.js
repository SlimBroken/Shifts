// dashboard.js
export function loadDashboard() {
  const lastUpdate = localStorage.getItem('lastUpdate');
  if (lastUpdate) {
    const timestamp = new Date(parseInt(lastUpdate));
    const readableTime = timestamp.toLocaleString();
    const lastUpdateElement = document.getElementById('lastUpdateDisplay');
    if (lastUpdateElement) {
      lastUpdateElement.innerHTML = `🕒 Last Updated: ${readableTime}`;
    }
  }
}
