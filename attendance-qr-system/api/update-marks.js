const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { indexNumber, course, field, value } = req.body;
    
    if (!indexNumber || !course || !field) {
        return res.status(400).json({ 
            success: false, 
            error: 'Missing required fields: indexNumber, course, field' 
        });
    }
    
    // Validate field name
    const validFields = ['midsem', 'classAssessment', 'exam'];
    if (!validFields.includes(field)) {
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid field. Must be: midsem, classAssessment, or exam' 
        });
    }
    
    try {
        const token = await getAccessToken();
        
        // Get current marks data
        const marksData = await getSheetData(token, process.env.SPREADSHEET_ID, 'marks_sheet');
        
        // Find if record exists for this student + course
        const rowIndex = marksData.findIndex(row => 
            row[0] && row[0].toString().trim() === indexNumber.toString().trim() &&
            row[2] === course
        );
        
        // Determine column index based on field
        const fieldToColumn = {
            'midsem': 3,
            'classAssessment': 4,
            'exam': 5
        };
        const columnIndex = fieldToColumn[field];
        
        if (rowIndex !== -1) {
            // Update existing record
            const existingRow = marksData[rowIndex];
            existingRow[columnIndex] = value.toString();
            
            // Also update the name if it exists in class_list
            const studentName = await getStudentName(token, indexNumber);
            if (studentName) {
                existingRow[1] = studentName;
            }
            
            await updateSheetRow(token, process.env.SPREADSHEET_ID, 'marks_sheet', rowIndex + 1, existingRow);
            
            res.status(200).json({ 
                success: true, 
                message: 'Mark updated successfully',
                action: 'updated'
            });
        } else {
            // Insert new record
            const studentName = await getStudentName(token, indexNumber);
            const newRow = [
                indexNumber.toString().trim(),
                studentName || 'Unknown',
                course,
                field === 'midsem' ? value.toString() : '',
                field === 'classAssessment' ? value.toString() : '',
                field === 'exam' ? value.toString() : ''
            ];
            
            await appendToSheet(token, process.env.SPREADSHEET_ID, 'marks_sheet', [newRow]);
            
            res.status(200).json({ 
                success: true, 
                message: 'New mark record created',
                action: 'inserted'
            });
        }
    } catch (error) {
        console.error('Error updating marks:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

async function getStudentName(accessToken, indexNumber) {
    try {
        const classList = await getSheetData(accessToken, process.env.SPREADSHEET_ID, 'class_list');
        const student = classList.find(row => 
            row[0] && row[0].toString().trim() === indexNumber.toString().trim()
        );
        return student ? student[1] || 'Unknown' : null;
    } catch (error) {
        console.error('Error getting student name:', error);
        return null;
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

async function updateSheetRow(accessToken, spreadsheetId, sheetName, rowIndex, values) {
    const range = `${sheetName}!A${rowIndex}:F${rowIndex}`;
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