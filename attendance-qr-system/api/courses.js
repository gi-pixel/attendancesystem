const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
    try {
        if (req.method === 'GET') {
            return handleGet(req, res);
        } else if (req.method === 'POST') {
            return handlePost(req, res);
        } else if (req.method === 'DELETE') {
            return handleDelete(req, res);
        } else {
            return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Unhandled error in courses API:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

// GET: list courses (+ professor_password for login bootstrap)
async function handleGet(req, res) {
    try {
        const token = await getAccessToken();

        // Fetch courses
        const courseRows = await getSheetData(token, process.env.SPREADSHEET_ID, 'courses');
        const courses = courseRows.slice(1).map(row => ({
            code: row[0] || '',
            name: row[1] || ''
        })).filter(c => c.code);

        // Fetch professor password from config sheet
        let professorPassword = null;
        try {
            const configData = await getSheetData(token, process.env.SPREADSHEET_ID, 'config');
            const config = {};
            configData.forEach(row => {
                if (row[0] && row[1]) config[row[0]] = row[1];
            });
            professorPassword = config.professor_password || 'admin123';
        } catch (e) {
            professorPassword = 'admin123';
        }

        res.status(200).json({
            success: true,
            courses,
            professor_password: professorPassword
        });
    } catch (error) {
        console.error('Error loading courses:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// POST: add a course
async function handlePost(req, res) {
    const { code, name } = req.body;

    if (!code || !name) {
        return res.status(400).json({ success: false, error: 'Course code and name are required' });
    }

    try {
        const token = await getAccessToken();
        const rows = await getSheetData(token, process.env.SPREADSHEET_ID, 'courses');

        // Check for duplicate code
        const exists = rows.slice(1).some(row => (row[0] || '').toUpperCase() === code.toUpperCase());
        if (exists) {
            return res.status(400).json({ success: false, error: 'Course code already exists' });
        }

        await appendToSheet(token, process.env.SPREADSHEET_ID, 'courses', [[code.toUpperCase(), name]]);
        res.status(200).json({ success: true, message: 'Course added' });
    } catch (error) {
        console.error('Error adding course:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// DELETE: remove a course (by code, from query)
async function handleDelete(req, res) {
    const { code } = req.query;

    if (!code) {
        return res.status(400).json({ success: false, error: 'Course code required' });
    }

    try {
        const token = await getAccessToken();
        const rows = await getSheetData(token, process.env.SPREADSHEET_ID, 'courses');

        // Find the row (1-based, +1 for header)
        let rowIndex = -1;
        for (let i = 1; i < rows.length; i++) {
            if ((rows[i][0] || '').toUpperCase() === code.toUpperCase()) {
                rowIndex = i + 1;
                break;
            }
        }

        if (rowIndex === -1) {
            return res.status(404).json({ success: false, error: 'Course not found' });
        }

        await clearSheetRow(token, process.env.SPREADSHEET_ID, 'courses', rowIndex);
        res.status(200).json({ success: true, message: 'Course deleted' });
    } catch (error) {
        console.error('Error deleting course:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// ----- Helpers -----
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
    const encodedRange = encodeURIComponent(`'${sheetName}'`);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`;
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!response.ok) {
        const body = await response.text();
        console.error(`[Sheets] FAILED sheet="${sheetName}" status=${response.status} body=${body}`);
        throw new Error(`Sheets API error for "${sheetName}": ${response.status} — ${body}`);
    }
    const data = await response.json();
    return data.values || [];
}

async function appendToSheet(accessToken, spreadsheetId, sheetName, values) {
    const encodedRange = encodeURIComponent(`'${sheetName}'`);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}:append?valueInputOption=RAW`;
    await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values })
    });
}

async function clearSheetRow(accessToken, spreadsheetId, sheetName, rowIndex) {
    const encodedRange = encodeURIComponent(`'${sheetName}'!A${rowIndex}:B${rowIndex}`);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}:clear`;
    await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
}

