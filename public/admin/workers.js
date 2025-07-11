// workers.js
// addWorker
function addWorker() {
    const input = document.getElementById('workerNameInput');
    const workerName = input.value.trim();
    
    if (!workerName) {
        showAlert('Please enter a worker name for SOC authorization.', 'warning');
        return;
    }

    const approvedWorkers = JSON.parse(localStorage.getItem('approvedWorkers') || '[]');
    
    if (approvedWorkers.some(name => name.toLowerCase() === workerName.toLowerCase())) {
        showAlert('Worker already authorized in SOC system.', 'warning');
        return;
    }

    approvedWorkers.push(workerName);
    localStorage.setItem('approvedWorkers', JSON.stringify(approvedWorkers));
    
    input.value = '';
    updateDisplay();
    saveData();
    showAlert(`✅ Worker "${workerName}" added to SOC authorized personnel!`, 'success');
    console.log('👤 SOC worker added:', workerName);
}

function removeWorker(workerName) {
    if (confirm(`Remove "${workerName}" from SOC authorized workers?\n\nThis will revoke their access to submit shift preferences.`)) {
        let approvedWorkers = JSON.parse(localStorage.getItem('approvedWorkers') || '[]');
        approvedWorkers = approvedWorkers.filter(name => name !== workerName);
        localStorage.setItem('approvedWorkers', JSON.stringify(approvedWorkers));
        
        updateDisplay();
        saveData();
        showAlert(`❌ Worker "${workerName}" removed from SOC authorization.`, 'success');
        console.log('👤 SOC worker removed:', workerName);
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
    updateWorkersList();
    updateLockStatus();
    updateSubmissionsList();
}

function updateWorkersList() {
    const workers = JSON.parse(localStorage.getItem('approvedWorkers') || '[]');
    const container = document.getElementById('workersList');
    
    if (workers.length === 0) {
        container.innerHTML = '<p style="color: #fef3c7;">No authorized SOC workers yet.</p>';
        return;
    }

    container.innerHTML = workers.map(worker => `
        <div class="worker-tag">
            <span>👤 ${worker}</span>
            <button onclick="removeWorker('${worker.replace(/'/g, "\\'")}')">✕</button>
        </div>
    `).join('');
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
function calculatePossibleVariations(submissions) {
            console.log('🔢 CALCULATING POSSIBLE SCHEDULE VARIATIONS...');
            
            const workers = submissions.map(s => ({
                name: s.name,
                preferences: s.preferences
            }));

            let totalVariations = 1;
            let constrainedShifts = 0;
            let impossibleShifts = 0;

            // Analyze each shift slot
            for (let globalDay = 0; globalDay < 14; globalDay++) {
                ['morning', 'evening', 'night'].forEach(shift => {
                    // Count available workers for this specific shift
                    const availableWorkers = workers.filter(worker => {
                        return worker.preferences[globalDay] && worker.preferences[globalDay][shift];
                    });

                    if (availableWorkers.length === 0) {
                        impossibleShifts++;
                    } else if (availableWorkers.length === 1) {
                        constrainedShifts++;
                        // Only 1 choice = no variation for this slot
                    } else {
                        // Multiple workers available = variations possible
                        totalVariations *= availableWorkers.length;
                        
                        // Cap the calculation to prevent overflow
                        if (totalVariations > 1000000) {
                            totalVariations = 1000000;
                        }
                    }
                });
            }

            console.log(`📊 Analysis: ${constrainedShifts} constrained shifts, ${impossibleShifts} impossible shifts`);
            
            // Estimate realistic variations considering constraints
            let estimatedVariations;
            if (totalVariations >= 1000000) {
                estimatedVariations = "1,000,000+";
            } else if (totalVariations >= 10000) {
                estimatedVariations = Math.round(totalVariations / 1000) + "K+";
            } else if (totalVariations >= 1000) {
                estimatedVariations = Math.round(totalVariations / 100) * 100 + "+";
            } else {
                estimatedVariations = totalVariations.toLocaleString();
            }

            return {
                estimated: estimatedVariations,
                raw: totalVariations,
                constrainedShifts: constrainedShifts,
                impossibleShifts: impossibleShifts
            };
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

// removeWorker
function removeWorker(workerName) {
    if (confirm(`Remove "${workerName}" from SOC authorized workers?\n\nThis will revoke their access to submit shift preferences.`)) {
        let approvedWorkers = JSON.parse(localStorage.getItem('approvedWorkers') || '[]');
        approvedWorkers = approvedWorkers.filter(name => name !== workerName);
        localStorage.setItem('approvedWorkers', JSON.stringify(approvedWorkers));
        
        updateDisplay();
        saveData();
        showAlert(`❌ Worker "${workerName}" removed from SOC authorization.`, 'success');
        console.log('👤 SOC worker removed:', workerName);
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
    updateWorkersList();
    updateLockStatus();
    updateSubmissionsList();
}

function updateWorkersList() {
    const workers = JSON.parse(localStorage.getItem('approvedWorkers') || '[]');
    const container = document.getElementById('workersList');
    
    if (workers.length === 0) {
        container.innerHTML = '<p style="color: #fef3c7;">No authorized SOC workers yet.</p>';
        return;
    }

    container.innerHTML = workers.map(worker => `
        <div class="worker-tag">
            <span>👤 ${worker}</span>
            <button onclick="removeWorker('${worker.replace(/'/g, "\\'")}')">✕</button>
        </div>
    `).join('');
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
function calculatePossibleVariations(submissions) {
            console.log('🔢 CALCULATING POSSIBLE SCHEDULE VARIATIONS...');
            
            const workers = submissions.map(s => ({
                name: s.name,
                preferences: s.preferences
            }));

            let totalVariations = 1;
            let constrainedShifts = 0;
            let impossibleShifts = 0;

            // Analyze each shift slot
            for (let globalDay = 0; globalDay < 14; globalDay++) {
                ['morning', 'evening', 'night'].forEach(shift => {
                    // Count available workers for this specific shift
                    const availableWorkers = workers.filter(worker => {
                        return worker.preferences[globalDay] && worker.preferences[globalDay][shift];
                    });

                    if (availableWorkers.length === 0) {
                        impossibleShifts++;
                    } else if (availableWorkers.length === 1) {
                        constrainedShifts++;
                        // Only 1 choice = no variation for this slot
                    } else {
                        // Multiple workers available = variations possible
                        totalVariations *= availableWorkers.length;
                        
                        // Cap the calculation to prevent overflow
                        if (totalVariations > 1000000) {
                            totalVariations = 1000000;
                        }
                    }
                });
            }

            console.log(`📊 Analysis: ${constrainedShifts} constrained shifts, ${impossibleShifts} impossible shifts`);
            
            // Estimate realistic variations considering constraints
            let estimatedVariations;
            if (totalVariations >= 1000000) {
                estimatedVariations = "1,000,000+";
            } else if (totalVariations >= 10000) {
                estimatedVariations = Math.round(totalVariations / 1000) + "K+";
            } else if (totalVariations >= 1000) {
                estimatedVariations = Math.round(totalVariations / 100) * 100 + "+";
            } else {
                estimatedVariations = totalVariations.toLocaleString();
            }

            return {
                estimated: estimatedVariations,
                raw: totalVariations,
                constrainedShifts: constrainedShifts,
                impossibleShifts: impossibleShifts
            };
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
