const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { sessionId, course, name, index, timestamp } = req.body;
    
    try {
        const token = await getAccessToken();
        
        // Check if session is active
        const sessions = await getSheetData(token, process.env.SPREADSHEET_ID, 'sessions');
        const session = sessions.find(row => row[0] === sessionId);
        
        if (!session) {
            return res.status(400).json({ success: false, message: 'Session not found' });
        }
        
        if (new Date(session[2]) < new Date()) {
            return res.status(400).json({ success: false, message: 'Session expired' });
        }
        
        // Record attendance
        await appendToSheet(token, process.env.SPREADSHEET_ID, 'attendance', [
            [timestamp, course, name, index, sessionId]
        ]);
        
        res.status(200).json({ success: true, message: 'Attendance recorded' });
    } catch (error) {
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

async function getSheetData(accessToken, spreadsheetId, sheetName) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}`;
    
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    const data = await response.json();
    return data.values || [];
}

async function appendToSheet(accessToken, spreadsheetId, sheetName, values) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}:append?valueInputOption=RAW`;
    
    await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values })
    });
}