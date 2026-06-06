const jwt = require('jsonwebtoken');

// ========== COURSE DASHBOARD API ==========
module.exports = async (req, res) => {
    const { course } = req.query;
    
    console.log(`[Dashboard] Request for course: ${course}`);
    
    if (!course) {
        return res.status(400).json({ 
            success: false, 
            error: 'Course parameter required' 
        });
    }
    
    try {
        const token = await getAccessToken();
        const sheetName = `${course}_Dashboard`;
        
        console.log(`[Dashboard] Looking for sheet: ${sheetName}`);
        
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.SPREADSHEET_ID}/values/${sheetName}`;
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            console.log(`[Dashboard] Sheet ${sheetName} not found or empty`);
            return res.status(200).json({ 
                success: true, 
                headers: [], 
                rows: [],
                message: `No dashboard found for ${course}. Generate a QR code first.`
            });
        }
        
        const data = await response.json();
        
        if (!data.values || data.values.length === 0) {
            console.log(`[Dashboard] No data in ${sheetName}`);
            return res.status(200).json({ 
                success: true, 
                headers: [], 
                rows: [],
                message: `Dashboard exists but has no student data for ${course}.`
            });
        }
        
        const headers = data.values[0] || [];
        const rows = data.values.slice(1) || [];
        
        console.log(`[Dashboard] Found ${headers.length} columns and ${rows.length} student rows`);
        
        res.status(200).json({ 
            success: true, 
            headers, 
            rows,
            totalStudents: rows.length
        });
        
    } catch (error) {
        console.error('[Dashboard] Error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            headers: [],
            rows: []
        });
    }
};

// ========== GET ACCESS TOKEN ==========
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
        console.error('Token error:', errorData);
        throw new Error(`Failed to get access token: ${errorData.error_description || errorData.error}`);
    }
    
    const data = await response.json();
    return data.access_token;
}