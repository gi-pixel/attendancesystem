const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { index } = req.body;
    
    if (!index) {
        return res.status(400).json({ 
            valid: false, 
            message: 'Index number required' 
        });
    }
    
    try {
        const token = await getAccessToken();
        const classList = await getSheetData(token, process.env.SPREADSHEET_ID, 'class_list');
        
        // Check if index number exists (case insensitive, trimmed)
        const student = classList.find(row => 
            row[0] && row[0].toString().trim() === index.toString().trim()
        );
        
        if (student) {
            res.status(200).json({ 
                valid: true, 
                message: 'Student verified',
                name: student[1] || ''
            });
        } else {
            res.status(200).json({ 
                valid: false, 
                message: 'You are not a registered student. Please contact your lecturer.' 
            });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            valid: false, 
            message: 'Verification failed. Please try again.' 
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