// Maccabi SOC Admin Dashboard - Period Management Functions
// Handles schedule periods, opening/closing periods, and period configuration

const PeriodManagement = {

    initialize: function() {
        console.log('📅 Initializing SOC period management...');
        
        document.getElementById('newPeriodStart').addEventListener('change', function() {
            const startDate = new Date(this.value);
            if (startDate) {
                const dayOfWeek = startDate.getDay();
                if (dayOfWeek !== 0) {
                    showAlert('⚠️ SOC Recommendation: Start date should be a Sunday for proper week alignment.', 'warning');
                }
                
                const endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 13);
                
                document.getElementById('newPeriodEnd').value = endDate.toISOString().split('T')[0];
                
                const startStr = startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
                const endStr = endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                document.getElementById('periodLabel').value = `${startStr} - ${endStr}`;
            }
        });
        
        this.updateCurrentPeriodDisplay();
    },

    updateCurrentPeriodDisplay: function() {
        const currentPeriod = this.getCurrentPeriodConfig();
        const displayDiv = document.getElementById('currentPeriodDisplay');
        
        if (currentPeriod && currentPeriod.isActive) {
            displayDiv.className = 'lock-status unlocked';
            displayDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                            <span class="security-icon">📅</span>
                            <strong style="font-size: 1.1em;">Current Active SOC Period: ${currentPeriod.label}</strong>
                        </div>
                        <small style="opacity: 0.9;">
                            📊 ${currentPeriod.startDate} to ${currentPeriod.endDate} | 
                            Created: ${new Date(currentPeriod.createdAt).toLocaleDateString()}
                        </small>
                    </div>
                    <div>
                        <button class="btn btn-danger" onclick="PeriodManagement.closePeriod()" style="padding: 8px 16px;">
                            <span class="security-icon">🔒</span> Close Period
                        </button>
                    </div>
                </div>
            `;
        } else {
            displayDiv.className = 'lock-status locked';
            displayDiv.innerHTML = `
                <div style="text-align: center;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 8px;">
                        <span class="security-icon">❌</span>
                        <strong style="font-size: 1.1em;">No Active SOC Period</strong>
                    </div>
                    <small>Workers cannot submit preferences until a new period is opened by SOC administration</small>
                </div>
            `;
        }
        this.updateScheduleRulesPeriodStatus();
    },

    getCurrentPeriodConfig: function() {
        try {
            const config = JSON.parse(localStorage.getItem('scheduleConfig') || '{}');
            return config.currentPeriod || null;
        } catch (error) {
            console.error('❌ Error reading SOC period config:', error);
            return null;
        }
    },

    setNextTwoWeeks: function() {
        const today = new Date();
        const nextSunday = new Date(today);
        
        const daysUntilSunday = (7 - today.getDay()) % 7;
        nextSunday.setDate(today.getDate() + (daysUntilSunday === 0 ? 7 : daysUntilSunday));
        
        document.getElementById('newPeriodStart').value = nextSunday.toISOString().split('T')[0];
        document.getElementById('newPeriodStart').dispatchEvent(new Event('change'));
        
        console.log('📅 SOC period set to next 2 weeks starting:', nextSunday.toDateString());
    },

    setSpecificDate: function(dateString) {
        document.getElementById('newPeriodStart').value = dateString;
        document.getElementById('newPeriodStart').dispatchEvent(new Event('change'));
        
        console.log('📅 SOC period set to specific date:', dateString);
    },

    openNewPeriod: async function() {
        const startDate = document.getElementById('newPeriodStart').value;
        const endDate = document.getElementById('newPeriodEnd').value;
        const label = document.getElementById('periodLabel').value;
        
        if (!startDate || !endDate || !label) {
            showAlert('❌ Please fill in all SOC period details.', 'warning');
            return;
        }
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        const daysDiff = (end - start) / (1000 * 60 * 60 * 24);
        
        if (daysDiff !== 13) {
            showAlert('❌ SOC Period must be exactly 14 days (2 weeks).', 'warning');
            return;
        }
        
        const confirmMessage = `Open new SOC period: ${label}?\n\nThis will:\n• Archive current submissions\n• Clear existing schedules\n• Allow workers to submit new preferences\n\nContinue with SOC period activation?`;
        
        if (!confirm(confirmMessage)) {
            return;
        }
        
        console.log('📅 Opening new SOC period:', label);
        
        const newPeriod = {
            startDate: startDate,
            endDate: endDate,
            label: label,
            isActive: true,
            createdAt: new Date().toISOString(),
            createdBy: 'SOC Admin'
        };
        
        let currentData = {
            shiftSubmissions: JSON.parse(localStorage.getItem('shiftSubmissions') || '[]'),
            approvedWorkers: JSON.parse(localStorage.getItem('approvedWorkers') || '[]'),
            preferencesLocked: false,
            lockTimestamp: '',
            scheduleConfig: {
                currentPeriod: newPeriod,
                history: JSON.parse(localStorage.getItem('scheduleConfig') || '{}').history || []
            }
        };
        
        // Archive old submissions if requested
        if (document.getElementById('archiveOldSubmissions').checked && currentData.shiftSubmissions.length > 0) {
            const archiveEntry = {
                archivedAt: new Date().toISOString(),
                periodLabel: this.getCurrentPeriodConfig()?.label || 'Previous Period',
                submissions: [...currentData.shiftSubmissions],
                archivedBy: 'SOC Admin'
            };
            currentData.scheduleConfig.history.unshift(archiveEntry);
            
            // Keep only last 10 archived periods
            if (currentData.scheduleConfig.history.length > 10) {
                currentData.scheduleConfig.history = currentData.scheduleConfig.history.slice(0, 10);
            }
            
            currentData.shiftSubmissions = [];
            console.log('📦 SOC archived', archiveEntry.submissions.length, 'submissions from previous period');
        }
        
        // Clear old schedules if requested
        if (document.getElementById('clearOldSchedules').checked) {
            document.getElementById('scheduleOutput').innerHTML = '';
            console.log('🗑️ SOC cleared previous schedule displays');
        }
        
        // Save all data
        localStorage.setItem('scheduleConfig', JSON.stringify(currentData.scheduleConfig));
        localStorage.setItem('shiftSubmissions', JSON.stringify(currentData.shiftSubmissions));
        localStorage.setItem('preferencesLocked', 'false');
        localStorage.setItem('lockTimestamp', '');
        
        // Update worker submissions in memory
        workerSubmissions = currentData.shiftSubmissions;
        
        await saveData();
        
        this.updateCurrentPeriodDisplay();
        updateDisplay();
        
        // Clear form
        document.getElementById('newPeriodStart').value = '';
        document.getElementById('newPeriodEnd').value = '';
        document.getElementById('periodLabel').value = '';
        
        showAlert(`✅ New SOC period opened: ${label}. Workers can now submit their preferences!`, 'success');
        console.log('✅ SOC period activated successfully:', label);
    },

    closePeriod: function() {
        const currentPeriod = this.getCurrentPeriodConfig();
        if (!currentPeriod) {
            showAlert('❌ No active SOC period to close.', 'warning');
            return;
        }
        
        const confirmMessage = `Close the current SOC period: ${currentPeriod.label}?\n\nThis will:\n• Prevent workers from submitting new preferences\n• Lock the current period\n• Require opening a new period for future submissions\n\nContinue with SOC period closure?`;
        
        if (!confirm(confirmMessage)) {
            return;
        }
        
        console.log('🔒 Closing SOC period:', currentPeriod.label);
        
        const config = JSON.parse(localStorage.getItem('scheduleConfig') || '{}');
        if (config.currentPeriod) {
            config.currentPeriod.isActive = false;
            config.currentPeriod.closedAt = new Date().toISOString();
            config.currentPeriod.closedBy = 'SOC Admin';
            localStorage.setItem('scheduleConfig', JSON.stringify(config));
            
            // Lock preferences when period is closed
            localStorage.setItem('preferencesLocked', 'true');
            localStorage.setItem('lockTimestamp', Date.now().toString());
            
            saveData();
            this.updateCurrentPeriodDisplay();
            updateDisplay();
            
            showAlert(`🔒 SOC period closed: ${currentPeriod.label}. Workers can no longer submit preferences.`, 'info');
            console.log('✅ SOC period closed successfully');
        }
    },

    updateScheduleRulesPeriodStatus: function() {
        const periodStatus = document.getElementById('scheduleRulesPeriodStatus');
        if (!periodStatus) return;
        
        const currentPeriod = this.getCurrentPeriodConfig();
        
        if (currentPeriod && currentPeriod.isActive) {
            periodStatus.innerHTML = `
                <div style="background: rgba(34, 197, 94, 0.2); color: #bbf7d0; border: 1px solid rgba(34, 197, 94, 0.4);">
                    ✅ <strong>Active Period:</strong> ${currentPeriod.label} (${currentPeriod.startDate} to ${currentPeriod.endDate})
                </div>
            `;
        } else {
            periodStatus.innerHTML = `
                <div style="background: rgba(239, 68, 68, 0.2); color: #fecaca; border: 1px solid rgba(239, 68, 68, 0.4);">
                    ❌ <strong>No Active Period:</strong> Schedule generation requires an active period to be opened first
                </div>
            `;
        }
    }
};

// Global functions that need to be accessible from HTML
window.setNextTwoWeeks = PeriodManagement.setNextTwoWeeks.bind(PeriodManagement);
window.setSpecificDate = PeriodManagement.setSpecificDate.bind(PeriodManagement);
window.openNewPeriod = PeriodManagement.openNewPeriod.bind(PeriodManagement);
window.closePeriod = PeriodManagement.closePeriod.bind(PeriodManagement);
