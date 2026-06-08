const jwt = require('jsonwebtoken');
const { sendTelegramAlert } = require('./telegram.js');


module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { course, duration, requireLocation, classLat, classLng } = req.body;

    const sessionId = `SESSION_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const expiresAt = new Date(Date.now() + duration * 60000).toISOString();
    
    try {
        const token = await getAccessToken();
        
        await appendToSheet(token, process.env.SPREADSHEET_ID, 'sessions', [
            [sessionId, course, expiresAt, new Date().toISOString(), requireLocation ? 'YES' : 'NO', classLat || '', classLng || '']
        ]);
        
        // Send Telegram Alert for session start
        const courseNames = {
            'CS101': ' Computer Science 101',
            'MATH201': ' Mathematics 201',
            'ENG101': ' English 101',
            'PHYS101': ' Physics 101',
            'CHEM101': ' Chemistry 101',
            'BUS101': ' Business 101'
        };
        const courseDisplay = courseNames[course] || course;
        
        await sendTelegramAlert(
            ` <b>Attendance Session Started</b>\n\n` +
            `${courseDisplay}\n` +
            `Session: <code>${sessionId}</code>\n` +
            `Duration: ${duration} minutes\n` +
            `Expires: ${new Date(expiresAt).toLocaleTimeString()}`
        );
        
        res.status(200).json({
            success: true,
            sessionId,
            expiresAt
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

async function getAccessToken() {
    const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
    
    const payload = {
        iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: 'https://oauth2.googleapis.com/token',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
    };
    
    const assertion = jwt.sign(payload, privateKey, { algorithm: 'RS256' });
    
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: assertion
        })
    });
    
    const data = await response.json();
    return data.access_token;
}

async function appendToSheet(accessToken, spreadsheetId, sheetName, values) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}:append?valueInputOption=RAW`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values })
    });
    
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Sheets API error: ${error}`);
    }
    
    return response.json();
}