// Maccabi SOC Admin Dashboard - Worker Management Functions
// Handles adding, removing, and validating workers

const WorkerManagement = {
    
    addWorker: function() {
        const input = document.getElementById('workerNameInput');
        const workerName = input.value.trim();
        
        if (!workerName) {
            showAlert('Please enter a worker name for SOC authorization.', 'warning');
            return;
        }

        // Validate input
        const validation = this.validateWorkerName(workerName);
        if (!validation.valid) {
            showAlert(`❌ SOC Validation Error: ${validation.message}`, 'warning');
            return;
        }

        const approvedWorkers = JSON.parse(localStorage.getItem('approvedWorkers') || '[]');
        
        // Check for duplicates (case-insensitive)
        if (approvedWorkers.some(name => name.toLowerCase() === workerName.toLowerCase())) {
            showAlert(`⚠️ Worker "${workerName}" is already authorized in SOC system.`, 'warning');
            input.focus();
            return;
        }

        // Add to approved workers
        approvedWorkers.push(workerName);
        localStorage.setItem('approvedWorkers', JSON.stringify(approvedWorkers));
        
        input.value = '';
        updateDisplay();
        saveData();
        
        showAlert(`✅ SOC Authorization granted to "${workerName}"! They can now access the preference system.`, 'success');
        console.log('👤 SOC worker authorized:', workerName, '| Total authorized:', approvedWorkers.length);
    },

    removeWorker: function(workerName) {
        // Check if worker has active submissions
        const hasSubmissions = workerSubmissions.some(s => s.name === workerName);
        
        let confirmMessage = `Remove "${workerName}" from SOC authorized workers?\n\n`;
        confirmMessage += `This will:\n`;
        confirmMessage += `• Revoke their access to submit shift preferences\n`;
        confirmMessage += `• Remove them from the authorized personnel list\n`;
        
        if (hasSubmissions) {
            confirmMessage += `• Their existing submission will remain (but they cannot modify it)\n`;
        }
        
        confirmMessage += `\nContinue with SOC authorization removal?`;
        
        if (confirm(confirmMessage)) {
            let approvedWorkers = JSON.parse(localStorage.getItem('approvedWorkers') || '[]');
            const originalCount = approvedWorkers.length;
            approvedWorkers = approvedWorkers.filter(name => name !== workerName);
            
            if (approvedWorkers.length === originalCount) {
                showAlert(`⚠️ Worker "${workerName}" was not found in SOC authorization list.`, 'warning');
                return;
            }
            
            localStorage.setItem('approvedWorkers', JSON.stringify(approvedWorkers));
            
            updateDisplay();
            saveData();
            
            showAlert(`❌ SOC authorization revoked for "${workerName}". They can no longer access the system.`, 'success');
            console.log('👤 SOC worker authorization revoked:', workerName, '| Remaining authorized:', approvedWorkers.length);
        }
    },

    validateWorkerName: function(name) {
        // Basic validation for SOC worker names
        if (!name || name.length < 2) {
            return { valid: false, message: 'Worker name must be at least 2 characters long.' };
        }
        
        if (name.length > 50) {
            return { valid: false, message: 'Worker name cannot exceed 50 characters.' };
        }
        
        // Check for potentially problematic characters
        const invalidChars = /[<>\"'&]/;
        if (invalidChars.test(name)) {
            return { valid: false, message: 'Worker name contains invalid characters.' };
        }
        
        return { valid: true };
    },

    updateWorkersList: function() {
        const workers = JSON.parse(localStorage.getItem('approvedWorkers') || '[]');
        const container = document.getElementById('workersList');
        
        if (workers.length === 0) {
            container.innerHTML = '<p style="color: #fef3c7;">No authorized SOC workers yet.</p>';
            return;
        }

        container.innerHTML = workers.map(worker => `
            <div class="worker-tag">
                <span>👤 ${worker}</span>
                <button onclick="WorkerManagement.removeWorker('${worker.replace(/'/g, "\\'")}')">✕</button>
            </div>
        `).join('');
    },

    exportWorkerList: function() {
        const approvedWorkers = JSON.parse(localStorage.getItem('approvedWorkers') || '[]');
        
        if (approvedWorkers.length === 0) {
            showAlert('❌ No SOC workers to export.', 'warning');
            return;
        }
        
        const exportData = {
            exportedAt: new Date().toISOString(),
            exportedBy: 'SOC Admin',
            totalWorkers: approvedWorkers.length,
            workers: approvedWorkers
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `soc_workers_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showAlert(`📋 SOC worker list exported (${approvedWorkers.length} workers).`, 'success');
        console.log('📋 SOC worker list exported:', approvedWorkers.length, 'workers');
    },

    getWorkerStatistics: function() {
        const approvedWorkers = JSON.parse(localStorage.getItem('approvedWorkers') || '[]');
        const totalWorkers = approvedWorkers.length;
        const workersWithSubmissions = workerSubmissions.length;
        const approvedSubmissions = workerSubmissions.filter(s => s.approved).length;
        const pendingSubmissions = workersWithSubmissions - approvedSubmissions;
        
        return {
            totalWorkers,
            workersWithSubmissions,
            approvedSubmissions,
            pendingSubmissions,
            submissionRate: totalWorkers > 0 ? (workersWithSubmissions / totalWorkers * 100).toFixed(1) : 0,
            approvalRate: workersWithSubmissions > 0 ? (approvedSubmissions / workersWithSubmissions * 100).toFixed(1) : 0
        };
    }
};

// Global functions that need to be accessible from HTML
window.addWorker = WorkerManagement.addWorker.bind(WorkerManagement);
window.removeWorker = WorkerManagement.removeWorker.bind(WorkerManagement);
