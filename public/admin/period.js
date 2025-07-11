// period.js
export function setSchedulePeriod(startDate, label) {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(start.getDate() + 13); // 14-day period

  const currentPeriod = {
    label,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    isActive: true
  };

  const config = {
    currentPeriod,
    lastUpdate: Date.now()
  };

  localStorage.setItem('scheduleConfig', JSON.stringify(config));
  localStorage.setItem('lastUpdate', Date.now().toString());
  return config;
}

export function loadSchedulePeriod() {
  try {
    const config = JSON.parse(localStorage.getItem('scheduleConfig') || '{}');
    return config.currentPeriod || null;
  } catch (error) {
    console.error('Error loading period config:', error);
    return null;
  }
}
