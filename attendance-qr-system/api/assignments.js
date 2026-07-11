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
        console.error('Unhandled error in assignments API:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// GET: Fetch assignments
async function handleGet(req, res) {
    const { course, type } = req.query;
    try {
        const token = await getAccessToken();
        const rows = await getSheetData(token, process.env.SPREADSHEET_ID, 'assignments');
        
        // Skip header row
        const assignments = rows.slice(1).map(row => ({
            id: row[0] || '',
            course: row[1] || '',
            title: row[2] || '',
            description: row[3] || '',
            dueDate: row[4] || '',
            postedDate: row[5] || '',
            status: row[6] || 'pending',
            type: row[7] || 'assignment'
        }));

        let filtered = assignments;
        if (course) {
            filtered = filtered.filter(a => a.course === course);
        }
        if (type) {
            filtered = filtered.filter(a => a.type === type);
        }

        filtered.sort((a, b) => {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate) - new Date(b.dueDate);
        });

        res.status(200).json({ success: true, assignments: filtered });
    } catch (error) {
        console.error('Error fetching assignments:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// POST: Create new assignment
async function handlePost(req, res) {
    const { course, title, description, dueDate, type } = req.body;
    
    // Required fields (dueDate not required for all)
    if (!course || !title || !description || !type) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    // For assignments, dueDate is mandatory
    if (type === 'assignment' && !dueDate) {
        return res.status(400).json({ success: false, error: 'Due date required for assignments' });
    }

    try {
        const token = await getAccessToken();
        const id = `ASSIGN_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const postedDate = new Date().toISOString().split('T')[0];
        const status = 'pending';
        // For announcements, store an empty string; for assignments, use the provided date
        const dueDateValue = type === 'announcement' ? '' : dueDate;
        const newRow = [id, course, title, description, dueDateValue, postedDate || '', status, type];

        await appendToSheet(token, process.env.SPREADSHEET_ID, 'assignments', [newRow]);
        res.status(200).json({ success: true, message: 'Assignment created', id });
    } catch (error) {
        console.error('Error creating assignment:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// DELETE: Remove assignment by ID
async function handleDelete(req, res) {
    const { id } = req.query;
    
    if (!id) {
        return res.status(400).json({ success: false, error: 'ID required' });
    }

    try {
        const token = await getAccessToken();
        const rows = await getSheetData(token, process.env.SPREADSHEET_ID, 'assignments');
        
        let rowIndex = -1;
        for (let i = 1; i < rows.length; i++) {
            if (rows[i][0] === id) {
                rowIndex = i + 1;
                break;
            }
        }

        if (rowIndex === -1) {
            return res.status(404).json({ success: false, error: 'Assignment not found' });
        }

        await clearSheetRow(token, process.env.SPREADSHEET_ID, 'assignments', rowIndex);
        res.status(200).json({ success: true, message: 'Assignment deleted' });
    } catch (error) {
        console.error('Error deleting assignment:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// ----- Helper Functions (Server-Only) -----
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
    
    if (!response.ok) throw new Error(`Sheets API error: ${response.statusText}`);
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

async function clearSheetRow(accessToken, spreadsheetId, sheetName, rowIndex) {
    const range = `${sheetName}!A${rowIndex}:H${rowIndex}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:clear`;
    await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
}