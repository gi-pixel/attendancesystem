import { GoogleSpreadsheet } from 'google-spreadsheet';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { sessionId, course, name, index, timestamp } = req.body;
    
    if (!name || !index || !course) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    try {
        const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID);
        await doc.useServiceAccountAuth({
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        });
        
        await doc.loadInfo();
        
        // Check if session is still active
        const sessionsSheet = doc.sheetsByTitle['sessions'];
        const rows = await sessionsSheet.getRows();
        const session = rows.find(r => r.sessionId === sessionId);
        
        if (!session || new Date(session.expiresAt) < new Date()) {
            return res.status(400).json({ success: false, message: 'Session expired or invalid' });
        }
        
        // Check for duplicate attendance (prevent double marking)
        const attendanceSheet = doc.sheetsByTitle['attendance'];
        const existingRows = await attendanceSheet.getRows();
        const alreadyMarked = existingRows.some(r => r.sessionId === sessionId && r.indexNumber === index);
        
        if (alreadyMarked) {
            return res.status(400).json({ success: false, message: 'You have already marked attendance for this session' });
        }
        
        // Record attendance
        await attendanceSheet.addRow({
            timestamp,
            course,
            name,
            indexNumber: index,
            sessionId
        });
        
        res.status(200).json({ success: true, message: 'Attendance recorded successfully' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}