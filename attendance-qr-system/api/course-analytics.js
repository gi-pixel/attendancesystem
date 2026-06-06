const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
    const { course } = req.query;
    
    if (!course) {
        return res.status(400).json({ error: 'Course parameter required' });
    }
    
    try {
        const token = await getAccessToken();
        
        // Get attendance data
        const attendance = await getSheetData(token, process.env.SPREADSHEET_ID, 'attendance');
        const courseAttendance = attendance.filter(row => row[1] === course);
        
        // Get class list for this course (all registered students)
        const classList = await getSheetData(token, process.env.SPREADSHEET_ID, 'class_list');
        const students = classList.map(row => ({
            index: row[0] || '',
            name: row[1] || ''
        }));
        
        // Calculate total weeks (based on min and max week number in attendance)
        const weeks = [...new Set(courseAttendance.map(row => row[5]))].sort((a,b) => a-b);
        const totalWeeks = weeks.length > 0 ? Math.max(...weeks) : 1;
        
        // Calculate per student attendance
        const studentStats = students.map(student => {
            const studentRecords = courseAttendance.filter(row => row[3] === student.index);
            const presentWeeks = new Set(studentRecords.map(row => row[5])).size;
            const percentage = totalWeeks > 0 ? (presentWeeks / totalWeeks) * 100 : 0;
            
            return {
                name: student.name,
                index: student.index,
                present: presentWeeks,
                total: totalWeeks,
                percentage: percentage.toFixed(1),
                status: percentage >= 75 ? 'Good' : (percentage >= 50 ? 'Warning' : 'Danger')
            };
        }).sort((a,b) => b.percentage - a.percentage);
        
        // Calculate weekly trend
        const weeklyTrend = weeks.map(week => {
            const weekRecords = courseAttendance.filter(row => row[5] === week);
            const uniqueStudents = new Set(weekRecords.map(row => row[3])).size;
            return {
                week: parseInt(week),
                attendance: uniqueStudents,
                total: students.length,
                percentage: students.length > 0 ? (uniqueStudents / students.length) * 100 : 0
            };
        });
        
        // Summary stats
        const totalAttendance = courseAttendance.length;
        const uniqueStudents = new Set(courseAttendance.map(row => row[3])).size;
        const averagePercentage = studentStats.reduce((sum, s) => sum + parseFloat(s.percentage), 0) / (studentStats.length || 1);
        
        res.status(200).json({
            success: true,
            summary: {
                totalStudents: students.length,
                totalAttendance: totalAttendance,
                uniqueStudents: uniqueStudents,
                totalWeeks: totalWeeks,
                averagePercentage: averagePercentage.toFixed(1)
            },
            weeklyTrend,
            students: studentStats
        });
        
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ success: false, error: error.message });
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