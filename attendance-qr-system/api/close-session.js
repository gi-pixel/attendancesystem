import { GoogleSpreadsheet } from 'google-spreadsheet';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { sessionId } = req.body;
    
    try {
        const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID);
        await doc.useServiceAccountAuth({
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        });
        
        await doc.loadInfo();
        
        const sessionsSheet = doc.sheetsByTitle['sessions'];
        const rows = await sessionsSheet.getRows();
        const session = rows.find(r => r.sessionId === sessionId);
        
        if (session) {
            // Set expiry to now to close session
            session.expiresAt = new Date().toISOString();
            await session.save();
        }
        
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}