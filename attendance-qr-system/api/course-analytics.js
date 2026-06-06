const jwt = require('jsonwebtoken');

// Calculate current academic week based on start date
function getCurrentAcademicWeek() {
    const startDate = new Date('2026-05-10'); // Change to your semester start date
    const currentDate = new Date();
    const diffTime = currentDate - startDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    let weekNum = Math.floor(diffDays / 7) + 1;
    if (weekNum < 1) weekNum = 1;
    if (weekNum > 16) weekNum = 16;
    return weekNum;
}

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
        
        // OPTION A: Use current academic week as total weeks
        const totalWeeks = getCurrentAcademicWeek();
        
        // Get all weeks that have attendance data (for trend chart)
        const weeksWithData = [...new Set(courseAttendance.map(row => parseInt(row[5])))]
            .filter(w => !isNaN(w))
            .sort((a,b) => a-b);
        
        // Calculate per student attendance
        const studentStats = students.map(student => {
            const studentRecords = courseAttendance.filter(row => row[3] === student.index);
            const presentWeeks = new Set(studentRecords.map(row => parseInt(row[5]))).size;
            const percentage = totalWeeks > 0 ? (presentWeeks / totalWeeks) * 100 : 0;
            
            let status = 'Danger';
            if (percentage >= 75) status = 'Good';
            else if (percentage >= 50) status = 'Warning';
            
            return {
                name: student.name || 'Unknown',
                index: student.index,
                present: presentWeeks,
                total: totalWeeks,
                percentage: percentage.toFixed(1),
                status: status
            };
        }).sort((a,b) => b.percentage - a.percentage);
        
        // Calculate weekly trend for weeks 1 to current week
        const weeklyTrend = [];
        for (let week = 1; week <= totalWeeks; week++) {
            const weekRecords = courseAttendance.filter(row => parseInt(row[5]) === week);
            const uniqueStudents = new Set(weekRecords.map(row => row[3])).size;
            weeklyTrend.push({
                week: week,
                attendance: uniqueStudents,
                total: students.length,
                percentage: students.length > 0 ? (uniqueStudents / students.length) * 100 : 0,
                hasData: weekRecords.length > 0
            });
        }
        
        // Summary stats
        const totalAttendance = courseAttendance.length;
        const uniqueStudents = new Set(courseAttendance.map(row => row[3])).size;
        const studentsWithAttendance = studentStats.filter(s => s.present > 0).length;
        const averagePercentage = studentStats.reduce((sum, s) => sum + parseFloat(s.percentage), 0) / (studentStats.length || 1);
        
        res.status(200).json({
            success: true,
            summary: {
                totalStudents: students.length,
                totalAttendance: totalAttendance,
                uniqueStudents: uniqueStudents,
                studentsWithAttendance: studentsWithAttendance,
                totalWeeks: totalWeeks,
                averagePercentage: averagePercentage.toFixed(1),
                currentWeek: totalWeeks
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