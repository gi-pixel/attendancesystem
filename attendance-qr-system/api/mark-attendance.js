const jwt = require('jsonwebtoken');

// Week calculation helper
function getWeekNumber() {
    const startDate = new Date('2026-05-10');
    const currentDate = new Date();
    const diffTime = currentDate - startDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    let weekNum = Math.floor(diffDays / 7) + 1;
    if (weekNum < 1) weekNum = 1;
    if (weekNum > 16) weekNum = 16;
    return weekNum;
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { sessionId, course, name, index, timestamp } = req.body;
    const weekNumber = getWeekNumber();
    
    if (!name || !index || !course || !sessionId) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
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
        
        // Verify student
        const verification = await verifyStudent(token, index);
        if (!verification.valid) {
            return res.status(400).json({ success: false, message: verification.message });
        }
        
        // Check if already marked for this week
        const attendance = await getSheetData(token, process.env.SPREADSHEET_ID, 'attendance');
        const alreadyMarked = attendance.some(row => 
            row[3] === index && row[1] === course && row[5] === weekNumber.toString()
        );
        
        if (alreadyMarked) {
            return res.status(400).json({ success: false, message: 'You already marked attendance for this week' });
        }
        
        // If location required, verify distance (add this after session validation)
        if (session[4] === 'YES' && session[5] && session[6]) {
            const { userLat, userLng } = req.body;
            
            if (!userLat || !userLng) {
                return res.status(400).json({ success: false, message: 'Location required for attendance' });
            }
            
            const distance = calculateDistance(
                parseFloat(session[5]), parseFloat(session[6]),
                userLat, userLng
            );
            
            if (distance > 30) {
                return res.status(400).json({ success: false, message: `You are ${Math.round(distance)}m away. Must be within 30m of classroom.` });
            }
        }
        
        // Record attendance
        await appendToSheet(token, process.env.SPREADSHEET_ID, 'attendance', [
            [timestamp, course, name, index, sessionId, weekNumber.toString(), '2025-2026', '1']
        ]);
        
        res.status(200).json({ success: true, message: 'Attendance recorded' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

async function verifyStudent(accessToken, index) {
    try {
        const classList = await getSheetData(accessToken, process.env.SPREADSHEET_ID, 'class_list');
        const student = classList.find(row => 
            row[0] && row[0].toString().trim() === index.toString().trim()
        );
        
        if (student) {
            return { valid: true, message: 'Student verified', name: student[1] || '' };
        } else {
            return { valid: false, message: 'You are not a registered student. Please contact your lecturer.' };
        }
    } catch (error) {
        return { valid: false, message: 'Verification failed. Please try again.' };
    }
}

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