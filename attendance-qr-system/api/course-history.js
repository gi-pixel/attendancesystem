import { GoogleSpreadsheet } from 'google-spreadsheet';

export default async function handler(req, res) {
    const { course } = req.query;
    
    try {
        const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID);
        await doc.useServiceAccountAuth({
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        });
        
        await doc.loadInfo();
        
        const attendanceSheet = doc.sheetsByTitle['attendance'];
        const rows = await attendanceSheet.getRows();
        
        const courseRecords = rows.filter(row => row.course === course);
        
        const records = courseRecords.map(row => ({
            timestamp: row.timestamp,
            name: row.name,
            index: row.indexNumber,
            sessionId: row.sessionId
        }));
        
        const uniqueStudents = new Set(records.map(r => r.index)).size;
        const uniqueSessions = new Set(records.map(r => r.sessionId)).size;
        
        res.status(200).json({
            total: records.length,
            unique: uniqueStudents,
            sessions: uniqueSessions,
            records
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}