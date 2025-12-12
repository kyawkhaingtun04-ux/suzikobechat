// server.js
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Configuration ---
const GEMINI_KEYS = [
    process.env.GEMINI_KEY_1,
    process.env.GEMINI_KEY_2,
    process.env.GEMINI_KEY_3,
].filter(key => key);

const GEMINI_MODEL_NAME = "gemini-2.5-flash";
const BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_NAME}:generateContent`;

// --- Middleware ---
// ★ ここが重要：リクエストボディの最大サイズを広げる
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));
app.use(cors());

// --- Key Fallback Function ---
async function callGeminiWithFallback(payload) {
    let lastError = null;

    if (GEMINI_KEYS.length === 0) {
        throw new Error("Server Error: No Gemini API keys configured in environment variables.");
    }

    for (const key of GEMINI_KEYS) {
        if (!key) continue;

        const url = `${BASE_URL}?key=${key}`;

        try {
            const geminiResponse = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                timeout: 20000
            });

            if (geminiResponse.ok) {
                return await geminiResponse.json();
            }

            const errorText = await geminiResponse.text();
            lastError = `status=${geminiResponse.status}, body=${errorText}`;
            console.error(`[Gemini] Key failed, trying next one... (${lastError})`);

        } catch (error) {
            lastError = error.message;
            console.error(`[Gemini] Exception with key, trying next one... (${lastError})`);
        }
    }

    throw new Error(`All Gemini API keys failed. Last error: ${lastError}`);
}

// 3. PROXY ENDPOINT: /api/chat
app.post('/api/chat', async (req, res) => {
    const payload = req.body;

    try {
        const result = await callGeminiWithFallback(payload);
        res.json(result);
    } catch (error) {
        console.error("[/api/chat] Unexpected error:", error.message);
        res.status(500).json({
            error: "Failed to communicate with the AI model.",
            details: error.message
        });
    }
});

// 4. SERVE FRONTEND
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
