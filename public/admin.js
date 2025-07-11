import { initAuth } from './admin/auth.js';
import { loadDashboard } from './admin/dashboard.js';
import { manageWorkers } from './admin/workers.js';
import { handlePeriod } from './admin/period.js';
import { lockPreferences } from './admin/lock.js';
import { handleSubmissions } from './admin/submissions.js';
import { generateSchedule } from './admin/schedule.js';

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  loadDashboard();
  manageWorkers();
  handlePeriod();
  lockPreferences();
  handleSubmissions();
  generateSchedule();
});