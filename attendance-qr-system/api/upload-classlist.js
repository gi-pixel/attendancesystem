const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { students } = req.body;
    
    if (!students || !Array.isArray(students) || students.length === 0) {
        return res.status(400).json({ 
            success: false, 
            message: 'No student data provided' 
        });
    }
    
    try {
        const token = await getAccessToken();
        
        // Get existing class list
        const existingData = await getSheetData(token, process.env.SPREADSHEET_ID, 'class_list');
        
        // Check for duplicates and append new students
        let addedCount = 0;
        let duplicateCount = 0;
        
        for (const student of students) {
            const { indexNumber, name } = student;
            
            if (!indexNumber) continue;
            
            // Check if index already exists
            const exists = existingData.some(row => 
                row[0] && row[0].toString().trim() === indexNumber.toString().trim()
            );
            
            if (!exists) {
                await appendToSheet(token, process.env.SPREADSHEET_ID, 'class_list', [
                    [indexNumber.toString().trim(), name ? name.trim() : '']
                ]);
                addedCount++;
            } else {
                duplicateCount++;
            }
        }
        
        res.status(200).json({
            success: true,
            added: addedCount,
            duplicates: duplicateCount,
            message: `Added ${addedCount} students. ${duplicateCount} duplicates skipped.`
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to upload class list' 
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