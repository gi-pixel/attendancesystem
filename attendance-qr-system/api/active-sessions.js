import { GoogleSpreadsheet } from 'google-spreadsheet';

export default async function handler(req, res) {
    try {
        const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID);
        await doc.useServiceAccountAuth({
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        });
        
        await doc.loadInfo();
        
        const sessionsSheet = doc.sheetsByTitle['sessions'];
        const rows = await sessionsSheet.getRows();
        const now = new Date();
        
        const activeSessions = rows
            .filter(row => new Date(row.expiresAt) > now)
            .map(row => ({
                sessionId: row.sessionId,
                course: row.course,
                expiresAt: row.expiresAt
            }));
        
        res.status(200).json({ sessions: activeSessions });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}