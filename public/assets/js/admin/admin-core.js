// Maccabi SOC Admin Dashboard - Core Functions
// Handles login, initialization, and basic admin functionality

const ADMIN_PASSWORD = 'admin123';
let workerSubmissions = [];
let serverConnected = false;

// Initialize the admin dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Maccabi SOC Admin Dashboard starting...');
    
    // Set up event listeners
    setupEventListeners();
    
    // Test server connection
    testServerConnection();
});

function setupEventListeners() {
    document.getElementById('adminPassword').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            login();
        }
    });

    document.getElementById('workerNameInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addWorker();
        }
    });
}

async function testServerConnection() {
    try {
        const response = await fetch('/api/test');
        const result = await response.json();
        serverConnected = result.success;
        console.log('SOC server connection:', serverConnected ? '✅ Connected' : '❌ Disconnected');
    } catch (error) {
        serverConnected = false;
        console.log('SOC server connection: ❌ Failed');
    }
}

function login() {
    const password = document.getElementById('adminPassword').value;
    if (password === ADMIN_PASSWORD) {
        document.getElementById('loginSection').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        console.log('✅ SOC Admin authenticated successfully');
        loadData();
    } else {
        showAlert('Incorrect password. Access denied to SOC administration.', 'warning');
        document.getElementById('adminPassword').value = '';
        console.log('❌ SOC Admin authentication failed');
    }
}

async function loadData() {
    console.log('📥 Loading SOC data...');
    
    if (serverConnected) {
        try {
            const response = await fetch('/api/data');
            const result = await response.json();
            
            if (result.success) {
                const data = result.data;
                workerSubmissions = data.shiftSubmissions || [];
                
                // Update local storage with ALL data including scheduleConfig
                localStorage.setItem('shiftSubmissions', JSON.stringify(workerSubmissions));
                localStorage.setItem('approvedWorkers', JSON.stringify(data.approvedWorkers || []));
                localStorage.setItem('preferencesLocked', data.preferencesLocked ? 'true' : 'false');
                localStorage.setItem('lockTimestamp', data.lockTimestamp || '');
                localStorage.setItem('scheduleConfig', JSON.stringify(data.scheduleConfig || {}));
                
                console.log('✅ SOC data synced from server');
            }
        } catch (error) {
            console.error('❌ Failed to load from SOC server:', error);
            showAlert('Warning: Using local data - SOC server sync unavailable', 'warning');
        }
    }

    // Load from local storage as fallback
    workerSubmissions = JSON.parse(localStorage.getItem('shiftSubmissions') || '[]');
    
    updateDisplay();
    PeriodManagement.initialize();
    
    console.log('📊 SOC Dashboard initialized with', workerSubmissions.length, 'submissions');
}

async function saveData() {
    const data = {
        shiftSubmissions: workerSubmissions,
        approvedWorkers: JSON.parse(localStorage.getItem('approvedWorkers') || '[]'),
        preferencesLocked: localStorage.getItem('preferencesLocked') === 'true',
        lockTimestamp: localStorage.getItem('lockTimestamp') || '',
        scheduleConfig: JSON.parse(localStorage.getItem('scheduleConfig') || '{}'),
        lastUpdate: Date.now()
    };

    localStorage.setItem('shiftSubmissions', JSON.stringify(workerSubmissions));
    localStorage.setItem('lastUpdate', Date.now().toString());

    if (serverConnected) {
        try {
            const response = await fetch('/api/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            if (result.success) {
                console.log('✅ SOC data synced to server');
            } else {
                console.error('❌ SOC server sync failed:', result.error);
            }
        } catch (error) {
            console.error('❌ Failed to save to SOC server:', error);
        }
    } else {
        console.log('⚠️ SOC server offline - data saved locally only');
    }
}

function toggleLock() {
    const isLocked = localStorage.getItem('preferencesLocked') === 'true';
    const newState = !isLocked;
    
    localStorage.setItem('preferencesLocked', newState.toString());
    localStorage.setItem('lockTimestamp', Date.now().toString());
    
    updateDisplay();
    saveData();
    
    const message = newState ? 
        '🔒 SOC preference submissions locked!' : 
        '🔓 SOC preference submissions unlocked!';
    showAlert(message, newState ? 'warning' : 'success');
    
    console.log('🔒 SOC preference lock status:', newState ? 'LOCKED' : 'UNLOCKED');
}

function toggleApproval(submissionId) {
    const submission = workerSubmissions.find(s => s.id === submissionId);
    if (submission) {
        submission.approved = !submission.approved;
        updateDisplay();
        saveData();
        
        const status = submission.approved ? 'approved ✅' : 'unapproved ❌';
        showAlert(`${submission.name} ${status} by SOC administrator!`, 'success');
        console.log('📝 SOC submission status changed:', submission.name, '->', status);
    }
}

function removeSubmission(submissionId) {
    const submission = workerSubmissions.find(s => s.id === submissionId);
    if (submission && confirm(`Remove ${submission.name}'s submission from SOC database?\n\nThis action cannot be undone.`)) {
        workerSubmissions = workerSubmissions.filter(s => s.id !== submissionId);
        updateDisplay();
        saveData();
        showAlert('📝 Submission removed from SOC database.', 'success');
        console.log('📝 SOC submission removed:', submission.name);
    }
}

function refreshData() {
    console.log('🔄 Refreshing SOC data...');
    loadData();
    showAlert('🔄 SOC data refreshed!', 'info');
}

function updateDisplay() {
    WorkerManagement.updateWorkersList();
    updateLockStatus();
    updateSubmissionsList();
}

function updateLockStatus() {
    const isLocked = localStorage.getItem('preferencesLocked') === 'true';
    const lockTimestamp = localStorage.getItem('lockTimestamp');
    const lockTime = lockTimestamp ? new Date(parseInt(lockTimestamp)).toLocaleString() : 'Unknown';
    
    const statusDiv = document.getElementById('lockStatus');
    const toggleBtn = document.getElementById('lockToggleBtn');
    
    if (isLocked) {
        statusDiv.className = 'lock-status locked';
        statusDiv.innerHTML = `
            <span style="font-size: 1.2em;">🔒 SOC PREFERENCES LOCKED</span><br>
            <small>Locked since: ${lockTime}</small><br>
            <small style="opacity: 0.8;">Workers cannot submit new preferences</small>
        `;
        toggleBtn.innerHTML = '<span class="security-icon">🔓</span> Unlock Preferences';
        toggleBtn.className = 'btn btn-success';
    } else {
        statusDiv.className = 'lock-status unlocked';
        statusDiv.innerHTML = `
            <span style="font-size: 1.2em;">🔓 SOC PREFERENCES UNLOCKED</span><br>
            <small>Workers can submit shift preferences</small><br>
            <small style="opacity: 0.8;">System accepting new submissions</small>
        `;
        toggleBtn.innerHTML = '<span class="security-icon">🔒</span> Lock Preferences';
        toggleBtn.className = 'btn btn-warning';
    }
}

function updateSubmissionsList() {
    const container = document.getElementById('submissionsList');
    
    if (workerSubmissions.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; 
                        background: rgba(59, 130, 246, 0.1); border-radius: 12px; border: 1px solid rgba(59, 130, 246, 0.3);">
                <h4 style="color: #dbeafe; margin-bottom: 10px;">📝 No Worker Submissions</h4>
                <p style="color: #dbeafe; opacity: 0.8;">No SOC personnel have submitted shift preferences yet.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = workerSubmissions.map(submission => {
        const availableShifts = Object.values(submission.preferences)
            .reduce((count, day) => count + (day.morning ? 1 : 0) + (day.evening ? 1 : 0) + (day.night ? 1 : 0), 0);

        const approvalIcon = submission.approved ? '✅' : '⏳';
        const cardClass = submission.approved ? 'submission-card approved' : 'submission-card';

        return `
            <div class="${cardClass}">
                <h4>
                    <span class="security-icon">👤</span> ${submission.name} ${approvalIcon}
                </h4>
                <p><strong>Available Shifts:</strong> ${availableShifts}/42 shifts</p>
                <p><strong>Submitted:</strong> ${new Date(submission.submittedAt).toLocaleString()}</p>
                ${submission.notes ? `<p><strong>Notes:</strong> ${submission.notes}</p>` : ''}
                <div style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
                    <button class="btn ${submission.approved ? '' : 'btn-success'}" onclick="toggleApproval(${submission.id})">
                        ${submission.approved ? '✓ Approved' : '📋 Approve'}
                    </button>
                    <button class="btn btn-danger" onclick="removeSubmission(${submission.id})">
                        🗑️ Remove
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span class="security-icon">${type === 'success' ? '✅' : type === 'warning' ? '⚠️' : type === 'danger' ? '❌' : 'ℹ️'}</span>
            <span>${message}</span>
        </div>
    `;
    
    const container = document.getElementById('statusMessages');
    container.appendChild(alertDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
    
    console.log(`📢 SOC Alert [${type.toUpperCase()}]:`, message);
}

// Global functions that need to be accessible from HTML
window.login = login;
window.toggleLock = toggleLock;
window.toggleApproval = toggleApproval;
window.removeSubmission = removeSubmission;
window.refreshData = refreshData;
