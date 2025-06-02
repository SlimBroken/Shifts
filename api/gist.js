const express = require('express');
const router = express.Router();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GIST_ID = process.env.GIST_ID;

// Validate environment variables
if (!GITHUB_TOKEN || !GIST_ID) {
    console.error('❌ Missing required environment variables: GITHUB_TOKEN, GIST_ID');
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
            const data = JSON.parse(fileContent);
            res.json({
                success: true,
                data: data,
                lastUpdate: data.lastUpdate || Date.now()
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'No data file found in gist'
            });
        }
    } catch (error) {
        console.error('Error fetching from GitHub:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch data from GitHub'
        });
    }
});

// Save data to GitHub Gist
router.post('/data', async (req, res) => {
    try {
        if (!GITHUB_TOKEN || !GIST_ID) {
            return res.status(500).json({
                success: false,
                error: 'Server configuration incomplete'
            });
        }

        const data = req.body;
        data.lastUpdate = Date.now();
        data.lastUpdateBy = req.ip || 'unknown';

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
                        content: JSON.stringify(data, null, 2)
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
            data: data,
            gistUrl: result.html_url
        });
    } catch (error) {
        console.error('Error saving to GitHub:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save data to GitHub'
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
                tokenValid: true
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
            error: 'Failed to test GitHub connection'
        });
    }
});

module.exports = router;
