import { GoogleSpreadsheet } from 'google-spreadsheet';

export default async function handler(req, res) {
    const { session } = req.query;
    
    try {
        const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID);
        await doc.useServiceAccountAuth({
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        });
        
        await doc.loadInfo();
        
        const sessionsSheet = doc.sheetsByTitle['sessions'];
        const rows = await sessionsSheet.getRows();
        const sessionRow = rows.find(r => r.sessionId === session);
        
        if (!sessionRow) {
            return res.status(200).json({ active: false, message: 'Session not found' });
        }
        
        const expiresAt = new Date(sessionRow.expiresAt);
        const now = new Date();
        const active = expiresAt > now;
        
        res.status(200).json({
            active,
            expiresIn: active ? expiresAt - now : 0,
            course: sessionRow.course
        });
    } catch (error) {
        res.status(500).json({ active: false, error: error.message });
    }
}