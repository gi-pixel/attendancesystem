const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
    try {
        const token = await getAccessToken();
        const sessions = await getSheetData(token, process.env.SPREADSHEET_ID, 'sessions');
        const now = new Date();
        
        const activeSessions = sessions
            .filter(row => row[2] && new Date(row[2]) > now)
            .map(row => ({
                sessionId: row[0],
                course: row[1],
                expiresAt: row[2],
                requireLocation: row[4] === 'YES' ? 'YES' : 'NO',
                classLat: row[5] || null,
                classLng: row[6] || null
            }));
        
        res.status(200).json({ sessions: activeSessions });
    } catch (error) {
        console.error('Error loading active sessions:', error);
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