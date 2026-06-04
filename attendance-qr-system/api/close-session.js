const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { sessionId } = req.body;
    
    try {
        const token = await getAccessToken();
        
        // Get all sessions
        const sessions = await getSheetData(token, process.env.SPREADSHEET_ID, 'sessions');
        
        // Find the session row index and update it
        const sessionIndex = sessions.findIndex(row => row[0] === sessionId);
        
        if (sessionIndex !== -1) {
            // Update expiresAt to now
            await updateSheetRow(token, process.env.SPREADSHEET_ID, 'sessions', sessionIndex + 1, [
                sessions[sessionIndex][0],
                sessions[sessionIndex][1],
                new Date().toISOString(),
                sessions[sessionIndex][3]
            ]);
        }
        
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
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

async function updateSheetRow(accessToken, spreadsheetId, sheetName, rowIndex, values) {
    const range = `${sheetName}!A${rowIndex}:D${rowIndex}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`;
    
    await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: [values] })
    });
}