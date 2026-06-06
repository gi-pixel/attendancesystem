const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
    const { course } = req.query;
    
    console.log(`[History] Request for course: ${course}`);
    
    if (!course) {
        return res.status(400).json({ error: 'Course parameter required' });
    }
    
    try {
        const token = await getAccessToken();
        const rows = await getSheetData(token, process.env.SPREADSHEET_ID, 'attendance');
        
        console.log(`[History] Total attendance records: ${rows.length}`);
        
        const courseRecords = rows.filter(row => row[1] === course);
        
        console.log(`[History] Records for ${course}: ${courseRecords.length}`);
        
        const records = courseRecords.map(row => ({
            timestamp: row[0] || '',
            name: row[2] || '',
            index: row[3] || '',
            sessionId: row[4] || ''
        }));
        
        const uniqueStudents = new Set(records.map(r => r.index)).size;
        const uniqueSessions = new Set(records.map(r => r.sessionId)).size;
        
        res.status(200).json({
            success: true,
            total: records.length,
            unique: uniqueStudents,
            sessions: uniqueSessions,
            records
        });
    } catch (error) {
        console.error('[History] Error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            records: [],
            total: 0,
            unique: 0,
            sessions: 0
        });
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
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Token error: ${errorData.error_description || errorData.error}`);
    }
    
    const data = await response.json();
    return data.access_token;
}

async function getSheetData(accessToken, spreadsheetId, sheetName) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}`;
    
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!response.ok) {
        throw new Error(`Sheets API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.values || [];
}