import { GoogleSpreadsheet } from 'google-spreadsheet';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { course, duration } = req.body;
    const sessionId = `SESSION_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const expiresAt = new Date(Date.now() + duration * 60000).toISOString();
    
    try {
        const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID);
        await doc.useServiceAccountAuth({
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        });
        
        await doc.loadInfo();
        
        const sessionsSheet = doc.sheetsByTitle['sessions'];
        await sessionsSheet.addRow({
            sessionId,
            course,
            expiresAt,
            createdAt: new Date().toISOString()
        });
        
        res.status(200).json({
            success: true,
            sessionId,
            expiresAt,
            url: `${process.env.VERCEL_URL}/index.html?session=${sessionId}&course=${course}`
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}