// server.js
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
// Render automatically sets the PORT environment variable
const PORT = process.env.PORT || 3000; 

// 1. SECURE ACCESS: Get the key from the Render Environment Variables
const API_KEY = process.env.GEMINI_API_KEY; 
const TEXT_MODEL_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

app.use(express.json()); // Middleware to parse JSON bodies

// 2. PROXY ENDPOINT: This handles the secure API call
// The front-end makes a POST request to /api/chat
app.post('/api/chat', async (req, res) => {
    if (!API_KEY) {
        // If the key is missing on Render, send a clear error message
        return res.status(500).json({ error: "Server Error: Gemini API key not configured on Render environment." });
    }

    // The entire payload (contents, systemInstruction, tools) is forwarded from the front-end
    const payload = req.body;
    
    try {
        const geminiResponse = await fetch(`${TEXT_MODEL_URL}?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // The status of the Gemini response is passed through
        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error("Gemini API Error:", geminiResponse.status, errorText);
            return res.status(geminiResponse.status).json({ 
                error: `Gemini API returned status ${geminiResponse.status}`,
                details: errorText
            });
        }

        const result = await geminiResponse.json();
        res.json(result); // Send the Gemini response back to the front-end

    } catch (error) {
        console.error("Proxy Call Failed:", error);
        // Catch network errors or JSON parsing failures
        res.status(500).json({ error: "Failed to communicate with the AI model due to a network or parsing error." });
    }
});

// 3. SERVE FRONTEND: Serve the index.html file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});