const jwt = require('jsonwebtoken');

// Week calculation helper
function getWeekNumber() {
    // Change this to your academic calendar start date
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
    
    // Validation
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
        
        // ========== VERIFY STUDENT (MOVED INSIDE TRY BLOCK) ==========
        const verification = await verifyStudent(token, index);
        if (!verification.valid) {
            return res.status(400).json({ 
                success: false, 
                message: verification.message 
            });
        }
        // ========== END VERIFICATION ==========
        
        // Check if already marked for this week
        const attendance = await getSheetData(token, process.env.SPREADSHEET_ID, 'attendance');
        const alreadyMarked = attendance.some(row => 
            row[3] === index && row[1] === course && row[5] === weekNumber.toString()
        );
        
        if (alreadyMarked) {
            return res.status(400).json({ success: false, message: 'You already marked attendance for this week' });
        }
        
        // Record attendance with week number
        await appendToSheet(token, process.env.SPREADSHEET_ID, 'attendance', [
            [timestamp, course, name, index, sessionId, weekNumber.toString(), '2025-2026', '1']
        ]);
        
        // Update dashboard checkbox
        await updateDashboardCheckbox(token, process.env.SPREADSHEET_ID, course, index, weekNumber);
        
        res.status(200).json({ success: true, message: 'Attendance recorded' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ========== VERIFY STUDENT FUNCTION (DEFINED BEFORE IT'S CALLED) ==========
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
        console.error('Verification error:', error);
        return { valid: false, message: 'Verification failed. Please try again.' };
    }
}

async function updateDashboardCheckbox(accessToken, spreadsheetId, course, index, weekNumber) {
    const sheetName = `${course}_Dashboard`;
    const range = `${sheetName}!A:Z`;
    
    // Get dashboard data
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    const data = await response.json();
    const rows = data.values || [];
    
    // Find student row
    let studentRowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
        if (rows[i] && rows[i][1] === index) {
            studentRowIndex = i + 1;
            break;
        }
    }
    
    if (studentRowIndex !== -1) {
        // Update checkbox column for this week (week number + 2 for column offset)
        const colLetter = getColumnLetter(weekNumber + 2);
        const updateRange = `${sheetName}!${colLetter}${studentRowIndex}`;
        const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${updateRange}?valueInputOption=RAW`;
        
        await fetch(updateUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ values: [['TRUE']] })
        });
        
        // Update total count
        await updateTotalCount(accessToken, spreadsheetId, sheetName, studentRowIndex, weekNumber);
    }
}

async function updateTotalCount(accessToken, spreadsheetId, sheetName, rowIndex, weekNumber) {
    // Get current total
    const totalCol = getColumnLetter(19); // Column S (Total)
    const totalRange = `${sheetName}!${totalCol}${rowIndex}`;
    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${totalRange}`;
    
    const response = await fetch(getUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const data = await response.json();
    let currentTotal = parseInt(data.values?.[0]?.[0]) || 0;
    currentTotal++;
    
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${totalRange}?valueInputOption=RAW`;
    await fetch(updateUrl, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: [[currentTotal.toString()]] })
    });
}

function getColumnLetter(num) {
    let letter = '';
    while (num > 0) {
        num--;
        letter = String.fromCharCode(65 + (num % 26)) + letter;
        num = Math.floor(num / 26);
    }
    return letter;
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