const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// IMPORTANT: Serve static files FIRST, before other routes
app.use(express.static('public'));

// API Routes
const gistRouter = require('./api/gist');
app.use('/api', gistRouter);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV || 'development'
    });
});

// HTML routes (these should come AFTER static files)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/worker', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'worker.html'));
});

app.get('/check', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'check.html'));
});

// Catch-all route for any other requests
app.get('*', (req, res) => {
    // If it's a request for an asset, return 404
    if (req.path.startsWith('/assets/')) {
        res.status(404).send('Asset not found');
        return;
    }
    
    // Otherwise, redirect to admin page
    res.redirect('/');
});

app.listen(PORT, () => {
    console.log(`🚀 Shift Scheduler running on port ${PORT}`);
});

module.exports = app;
