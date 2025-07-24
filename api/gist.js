const express = require('express');
const router = express.Router();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GIST_ID = process.env.GIST_ID;

// Validate environment variables
if (!GITHUB_TOKEN || !GIST_ID) {
    console.error('❌ Missing required environment variables: GITHUB_TOKEN, GIST_ID');
}

// Helper function to validate and structure data
function validateAndStructureData(data) {
    const structuredData = {
        shiftSubmissions: data.shiftSubmissions || [],
        approvedWorkers: data.approvedWorkers || [],
        preferencesLocked: Boolean(data.preferencesLocked),
        lockTimestamp: data.lockTimestamp || '',
        scheduleConfig: {
            currentPeriod: data.scheduleConfig?.currentPeriod || null,
            history: data.scheduleConfig?.history || []
        },
        lastUpdate: data.lastUpdate || Date.now(),
        lastUpdateBy: data.lastUpdateBy || 'unknown'
    };

    // Validate current period if it exists
    if (structuredData.scheduleConfig.currentPeriod) {
        const period = structuredData.scheduleConfig.currentPeriod;
        
        // Ensure required fields exist
        if (!period.startDate || !period.endDate || !period.label) {
            console.warn('⚠️ Invalid period configuration - missing required fields');
        }
        
        // Validate date format
        const startDate = new Date(period.startDate);
        const endDate = new Date(period.endDate);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            console.warn('⚠️ Invalid period dates');
        } else {
            // Check if period is exactly 14 days
            const daysDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);
            if (Math.abs(daysDiff - 13) > 0.1) { // Allow small floating point errors
                console.warn(`⚠️ Period is ${daysDiff + 1} days, expected 14 days`);
            }
        }
    }

    return structuredData;
}

// Get data from GitHub Gist
router.get('/data', async (req, res) => {
    try {
        if (!GITHUB_TOKEN || !GIST_ID) {
            return res.status(500).json({
                success: false,
                error: 'Server configuration incomplete'
            });
        }

        const response = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }

        const gist = await response.json();
        const fileContent = gist.files['shift_data.json']?.content;
        
        if (fileContent) {
            const rawData = JSON.parse(fileContent);
            const structuredData = validateAndStructureData(rawData);
            
            res.json({
                success: true,
                data: structuredData,
                lastUpdate: structuredData.lastUpdate,
                gistUrl: gist.html_url
            });
        } else {
            // Return default structure if no data exists
            const defaultData = validateAndStructureData({});
            res.json({
                success: true,
                data: defaultData,
                lastUpdate: defaultData.lastUpdate,
                message: 'No existing data - using defaults'
            });
        }
    } catch (error) {
        console.error('Error fetching from GitHub:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch data from GitHub',
            details: error.message
        });
    }
});

// Save data to GitHub Gist (Admin use)
router.post('/data', async (req, res) => {
    try {
        if (!GITHUB_TOKEN || !GIST_ID) {
            return res.status(500).json({
                success: false,
                error: 'Server configuration incomplete'
            });
        }

        // Validate and structure the incoming data
        const structuredData = validateAndStructureData(req.body);
        structuredData.lastUpdate = Date.now();
        structuredData.lastUpdateBy = req.ip || 'unknown';

        // Log the update for debugging
        console.log('📝 Saving data update:', {
            submissions: structuredData.shiftSubmissions.length,
            workers: structuredData.approvedWorkers.length,
            locked: structuredData.preferencesLocked,
            currentPeriod: structuredData.scheduleConfig.currentPeriod?.label || 'None',
            historyCount: structuredData.scheduleConfig.history.length,
            updateBy: structuredData.lastUpdateBy
        });

        const response = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                files: {
                    'shift_data.json': {
                        content: JSON.stringify(structuredData, null, 2)
                    }
                }
            })
        });

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }

        const result = await response.json();
        res.json({
            success: true,
            data: structuredData,
            gistUrl: result.html_url,
            message: 'Data saved successfully'
        });
    } catch (error) {
        console.error('Error saving to GitHub:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save data to GitHub',
            details: error.message
        });
    }
});

// NEW: Submit worker shift preferences
router.post('/submit-preferences', async (req, res) => {
    try {
        if (!GITHUB_TOKEN || !GIST_ID) {
            return res.status(500).json({
                success: false,
                error: 'Server configuration incomplete'
            });
        }

        const submission = req.body;

        // Validate submission
        if (!submission.name || !submission.preferences) {
            return res.status(400).json({
                success: false,
                error: 'Invalid submission: name and preferences required'
            });
        }

        console.log('👤 Worker submission received:', {
            name: submission.name,
            submittedAt: new Date(submission.submittedAt).toISOString(),
            hasNotes: !!submission.notes
        });

        // First, get current data
        const getCurrentData = async () => {
            const response = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }

            const gist = await response.json();
            const fileContent = gist.files['shift_data.json']?.content;
            
            if (fileContent) {
                return JSON.parse(fileContent);
            } else {
                // Return default structure if no data exists
                return {
                    shiftSubmissions: [],
                    approvedWorkers: [],
                    preferencesLocked: false,
                    lockTimestamp: '',
                    scheduleConfig: { currentPeriod: null, history: [] }
                };
            }
        };

        const currentData = await getCurrentData();

        // Check if preferences are locked
        if (currentData.preferencesLocked) {
            return res.status(423).json({
                success: false,
                error: 'Preference submissions are currently locked by SOC administration'
            });
        }

        // Check if worker is approved
        if (!currentData.approvedWorkers || !currentData.approvedWorkers.includes(submission.name)) {
            return res.status(403).json({
                success: false,
                error: 'Worker not found in approved workers list. Contact SOC administrator.'
            });
        }

        // Add unique ID to submission
        const submissionWithId = {
            ...submission,
            id: Date.now(),
            submittedAt: submission.submittedAt || Date.now(),
            approved: false
        };

        // Remove any existing submission from this worker
        const filteredSubmissions = currentData.shiftSubmissions.filter(s => s.name !== submission.name);
        
        // Add the new submission
        filteredSubmissions.push(submissionWithId);

        // Update the data structure
        const updatedData = validateAndStructureData({
            ...currentData,
            shiftSubmissions: filteredSubmissions,
            lastUpdate: Date.now(),
            lastUpdateBy: `Worker: ${submission.name}`
        });

        // Save to GitHub
        const response = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                files: {
                    'shift_data.json': {
                        content: JSON.stringify(updatedData, null, 2)
                    }
                }
            })
        });

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }

        const result = await response.json();

        console.log(`✅ Worker submission saved: ${submission.name} (${filteredSubmissions.length} total submissions)`);

        res.json({
            success: true,
            message: 'Shift preferences submitted successfully',
            submissionId: submissionWithId.id,
            gistUrl: result.html_url
        });

    } catch (error) {
        console.error('Error submitting worker preferences:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to submit preferences',
            details: error.message
        });
    }
});

// Get current period information (lightweight endpoint)
router.get('/period', async (req, res) => {
    try {
        if (!GITHUB_TOKEN || !GIST_ID) {
            return res.status(500).json({
                success: false,
                error: 'Server configuration incomplete'
            });
        }

        const response = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }

        const gist = await response.json();
        const fileContent = gist.files['shift_data.json']?.content;
        
        if (fileContent) {
            const data = JSON.parse(fileContent);
            const currentPeriod = data.scheduleConfig?.currentPeriod || null;
            
            res.json({
                success: true,
                currentPeriod: currentPeriod,
                isActive: currentPeriod?.isActive || false,
                preferencesLocked: Boolean(data.preferencesLocked),
                lastUpdate: data.lastUpdate || Date.now()
            });
        } else {
            res.json({
                success: true,
                currentPeriod: null,
                isActive: false,
                preferencesLocked: false,
                lastUpdate: Date.now()
            });
        }
    } catch (error) {
        console.error('Error fetching period info:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch period information',
            details: error.message
        });
    }
});

// Test GitHub connection
router.get('/test', async (req, res) => {
    try {
        if (!GITHUB_TOKEN) {
            return res.status(500).json({
                success: false,
                error: 'GitHub token not configured'
            });
        }

        const response = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (response.ok) {
            const user = await response.json();
            res.json({
                success: true,
                user: user.login,
                tokenValid: true,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(401).json({
                success: false,
                error: 'Invalid GitHub token'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to test GitHub connection',
            details: error.message
        });
    }
});

// Health check with enhanced information
router.get('/health', async (req, res) => {
    try {
        // Test GitHub connectivity
        let githubStatus = 'unknown';
        if (GITHUB_TOKEN && GIST_ID) {
            try {
                const testResponse = await fetch('https://api.github.com/user', {
                    headers: {
                        'Authorization': `Bearer ${GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });
                githubStatus = testResponse.ok ? 'connected' : 'auth_failed';
            } catch (error) {
                githubStatus = 'connection_failed';
            }
        } else {
            githubStatus = 'not_configured';
        }

        res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            env: process.env.NODE_ENV || 'development',
            github: githubStatus,
            features: {
                periodManagement: true,
                dataValidation: true,
                autoSync: true,
                workerSubmissions: true
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

module.exports = router;
