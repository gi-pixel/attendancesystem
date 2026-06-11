const jwt = require('jsonwebtoken');
const { sendTelegramAlert } = require('./telegram.js');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { sessionId } = req.body;
    
    try {
        const token = await getAccessToken();
        
        const sessions = await getSheetData(token, process.env.SPREADSHEET_ID, 'sessions');
        
        const sessionIndex = sessions.findIndex(row => row[0] === sessionId);
        
        if (sessionIndex !== -1) {
            const session = sessions[sessionIndex];
            const course = session[1];
            
            // Get attendance count for this session
            const attendance = await getSheetData(token, process.env.SPREADSHEET_ID, 'attendance');
            const sessionAttendance = attendance.filter(row => row[4] === sessionId);
            const attendanceCount = sessionAttendance.length;
            
            await updateSheetRow(token, process.env.SPREADSHEET_ID, 'sessions', sessionIndex + 1, [
                session[0],
                session[1],
                new Date().toISOString(),
                session[3]
            ]);
            
            // Send Telegram Alert for session closed
            const courseNames = {
                'CCS304': 'Telecommunication Networks',
                'CIIT302': 'Advanced Intelligent Networks',
                'CIIT306': 'Routing and Switching Technologies',
                'CIIT332': 'Software Defined Networks',
                'CIIT352': 'Windows Server Administration',
                'SCOT322': 'Sociology of Technology'
            };
            const courseDisplay = courseNames[course] || course;
            
            await sendTelegramAlert(
                ` <b>Attendance Session Closed</b>\n\n` +
                `${courseDisplay}\n` +
                ` Session: <code>${sessionId}</code>\n` +
                ` Total Attendance: ${attendanceCount} student${attendanceCount !== 1 ? 's' : ''}\n` +
                ` Closed at: ${new Date().toLocaleTimeString()}`
            );
        }
        
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error closing session:', error);
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