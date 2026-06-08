const tabs = document.querySelectorAll('.tab-btn');
const panes = document.querySelectorAll('.tab-pane');
const classListFile = document.getElementById('classListFile');
const uploadBtn = document.getElementById('uploadClassListBtn');
const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
const uploadResult = document.getElementById('uploadResult');
const locationToggle = document.getElementById('locationToggle');
const locationCoords = document.getElementById('locationCoords');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabId = tab.dataset.tab;
        tabs.forEach(t => t.classList.remove('active'));
        panes.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`tab-${tabId}`).classList.add('active');
    });
});

// Generate QR Code
const generateBtn = document.getElementById('generateBtn');
const qrResult = document.getElementById('qrResult');
const courseSelect = document.getElementById('courseSelect');
const sessionDuration = document.getElementById('sessionDuration');
let qrcode = null;

generateBtn.addEventListener('click', async () => {
    const course = courseSelect.value;
    const duration = parseInt(sessionDuration.value);
    
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
    
    try {
        const response = await fetch('/api/generate-qr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ course, duration })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Clear previous QR
            if (qrcode) {
                document.getElementById('qrcode').innerHTML = '';
            }
            
            // Generate new QR
            const attendanceUrl = `${window.location.origin}/index.html?session=${data.sessionId}&course=${course}`;
            qrcode = new QRCode(document.getElementById('qrcode'), {
                text: attendanceUrl,
                width: 200,
                height: 200
            });
            
            document.getElementById('qrCourse').textContent = course;
            document.getElementById('qrSessionId').textContent = data.sessionId;
            document.getElementById('qrExpiry').textContent = new Date(data.expiresAt).toLocaleTimeString();
            qrResult.style.display = 'block';
            
            // Scroll to QR
            qrResult.scrollIntoView({ behavior: 'smooth' });
        } else {
            alert('Failed to generate QR: ' + data.message);
        }
    } catch (error) {
        alert('Error generating QR code');
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate QR Code';
    }
});

// Copy Link
document.getElementById('copyLinkBtn')?.addEventListener('click', () => {
    const course = courseSelect.value;
    const sessionId = document.getElementById('qrSessionId').textContent;
    const url = `${window.location.origin}/index.html?session=${sessionId}&course=${course}`;
    navigator.clipboard.writeText(url);
    const msg = document.getElementById('copyMessage');
    msg.textContent = '✓ Link copied to clipboard!';
    setTimeout(() => msg.textContent = '', 3000);
});

// Load Active Sessions
async function loadActiveSessions() {
    try {
        const response = await fetch('/api/active-sessions');
        const data = await response.json();
        const container = document.getElementById('sessionsList');
        
        if (!data.sessions || data.sessions.length === 0) {
            container.innerHTML = '<div class="empty-state">No active sessions</div>';
            return;
        }
        
        container.innerHTML = data.sessions.map(session => `
            <div class="session-item">
                <div class="session-course">${session.course}</div>
                <div class="session-details">Session: ${session.sessionId}<br>Expires: ${new Date(session.expiresAt).toLocaleTimeString()}</div>
                <div class="session-status status-active">Active</div>
                <div class="session-actions">
                    <button class="btn-close" onclick="closeSession('${session.sessionId}')">Close Session</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading sessions');
    }
}

// Close Session
window.closeSession = async (sessionId) => {
    if (confirm('Close this session? Students will no longer be able to mark attendance.')) {
        await fetch('/api/close-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
        });
        loadActiveSessions();
        loadTodayAttendance();
    }
};

// Load Today's Attendance
async function loadTodayAttendance() {
    try {
        const response = await fetch('/api/today-attendance');
        const data = await response.json();
        
        document.getElementById('totalToday').textContent = data.total || 0;
        document.getElementById('uniqueToday').textContent = data.unique || 0;
        
        const tbody = document.getElementById('attendanceTableBody');
        if (!data.records || data.records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No records today</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.records.map(record => `
            <tr>
                <td>${new Date(record.timestamp).toLocaleTimeString()}</td>
                <td>${record.course}</td>
                <td>${record.name}</td>
                <td>${record.index}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading attendance');
    }
}

// Load Today's Attendance (Manual)
document.getElementById('loadTodayBtn')?.addEventListener('click', async () => {
    const loadBtn = document.getElementById('loadTodayBtn');
    const loading = document.getElementById('todayLoading');
    const stats = document.getElementById('todayStats');
    const tableWrapper = document.getElementById('todayTableWrapper');
    const tbody = document.getElementById('attendanceTableBody');
    const totalSpan = document.getElementById('totalToday');
    const uniqueSpan = document.getElementById('uniqueToday');
    
    // Show loading
    loadBtn.disabled = true;
    loadBtn.innerHTML = '<span class="loading-spinner"></span> Loading...';
    loading.style.display = 'block';
    stats.style.display = 'none';
    tableWrapper.style.display = 'none';
    
    try {
        const response = await fetch('/api/today-attendance');
        const data = await response.json();
        
        totalSpan.textContent = data.total || 0;
        uniqueSpan.textContent = data.unique || 0;
        
        if (!data.records || data.records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No records today</td></tr>';
        } else {
            tbody.innerHTML = data.records.map(record => `
                <tr>
                    <td>${new Date(record.timestamp).toLocaleTimeString()}</td>
                    <td>${record.course}</td>
                    <td>${escapeHtml(record.name)}</td>
                    <td>${record.index}</td>
                </tr>
            `).join('');
        }
        
        stats.style.display = 'grid';
        tableWrapper.style.display = 'block';
        
    } catch (error) {
        console.error('Error loading attendance:', error);
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Error loading data. Please try again.</td></tr>';
        stats.style.display = 'grid';
        tableWrapper.style.display = 'block';
    } finally {
        loadBtn.disabled = false;
        loadBtn.innerHTML = ' Load Today\'s Records';
        loading.style.display = 'none';
    }
});

// Export Today's Attendance as CSV
document.getElementById('exportTodayBtn')?.addEventListener('click', async () => {
    const exportBtn = document.getElementById('exportTodayBtn');
    exportBtn.disabled = true;
    exportBtn.innerHTML = '<span class="loading-spinner"></span> Exporting...';
    
    try {
        const response = await fetch('/api/today-attendance');
        const data = await response.json();
        
        if (!data.records || data.records.length === 0) {
            alert('No attendance records to export');
            return;
        }
        
        let csv = 'Timestamp,Course,Name,Index Number\n';
        data.records.forEach(record => {
            csv += `"${record.timestamp}","${record.course}","${record.name}","${record.index}"\n`;
        });
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        alert(` Exported ${data.records.length} records`);
    } catch (error) {
        console.error('Export error:', error);
        alert('Failed to export data');
    } finally {
        exportBtn.disabled = false;
        exportBtn.innerHTML = ' Export to CSV';
    }
});

// Keep the setInterval for sessions only
setInterval(() => {
    if (document.querySelector('.tab-btn[data-tab="sessions"]')?.classList.contains('active')) {
        loadActiveSessions();
    }
    // Remove today's attendance auto-refresh
}, 30000);

// Export CSV
document.getElementById('exportBtn')?.addEventListener('click', async () => {
    const response = await fetch('/api/today-attendance?export=true');
    const data = await response.json();
    
    let csv = 'Timestamp,Course,Name,Index Number\n';
    data.records.forEach(record => {
        csv += `"${record.timestamp}","${record.course}","${record.name}","${record.index}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${new Date().toISOString().slice(0, 19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
});

// Load History
document.getElementById('loadHistoryBtn')?.addEventListener('click', async () => {
    const course = document.getElementById('historyCourseSelect').value;
    const response = await fetch(`/api/course-history?course=${course}`);
    const data = await response.json();
    
    // Stats
    document.getElementById('historyStats').style.display = 'grid';
    document.getElementById('historyStats').innerHTML = `
        <div class="stat-card"><div class="stat-number">${data.total || 0}</div><div class="stat-label">Total Attendance</div></div>
        <div class="stat-card"><div class="stat-number">${data.unique || 0}</div><div class="stat-label">Unique Students</div></div>
        <div class="stat-card"><div class="stat-number">${data.sessions || 0}</div><div class="stat-label">Sessions</div></div>
    `;
    
    const tbody = document.getElementById('historyTableBody');
    if (!data.records || data.records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No records found</td></tr>';
        return;
    }
    
    tbody.innerHTML = data.records.map(record => `
        <tr>
            <td>${new Date(record.timestamp).toLocaleDateString()}</td>
            <td>${record.name}</td>
            <td>${record.index}</td>
            <td>${record.sessionId || '-'}</td>
        </tr>
    `).join('');
});

// Load initial data
loadActiveSessions();

// Refresh every 30 seconds
setInterval(() => {
    if (document.querySelector('.tab-btn[data-tab="sessions"]')?.classList.contains('active')) {
        loadActiveSessions();
    }
    if (document.querySelector('.tab-btn[data-tab="attendance"]')?.classList.contains('active')) {
        loadTodayAttendance();
    }
}, 30000);


// Upload CSV/Excel with loading indicator
uploadBtn?.addEventListener('click', async () => {
    const file = classListFile.files[0];
    if (!file) {
        showUploadMessage('Please select a CSV or Excel file', 'error');
        return;
    }
    
    const extension = file.name.split('.').pop().toLowerCase();
    
    if (extension !== 'csv' && extension !== 'xlsx' && extension !== 'xls') {
        showUploadMessage('Unsupported file type. Please upload CSV or Excel files.', 'error');
        return;
    }
    
    // Show loading state
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<span class="loading-spinner"></span> Uploading...';
    uploadBtn.classList.add('btn-loading');
    showUploadMessage('Processing file...', 'info');
    
    try {
        let students = [];
        
        if (extension === 'csv') {
            // Handle CSV
            const text = await readFileAsText(file);
            const lines = text.split('\n');
            const startIndex = lines[0].toLowerCase().includes('index') ? 1 : 0;
            
            for (let i = startIndex; i < lines.length; i++) {
                const values = lines[i].split(',');
                if (values.length >= 1 && values[0] && values[0].trim()) {
                    students.push({
                        indexNumber: values[0].trim(),
                        name: values[1] ? values[1].trim() : ''
                    });
                }
            }
        } else {
            // Handle Excel - check if SheetJS is available
            if (typeof XLSX === 'undefined') {
                throw new Error('Excel parser not loaded. Please refresh the page.');
            }
            
            const data = await readFileAsArrayBuffer(file);
            const workbook = XLSX.read(data, { type: 'array' });
            
            if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                throw new Error('No sheets found in Excel file');
            }
            
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
            
            if (!jsonData || jsonData.length === 0) {
                throw new Error('No data found in Excel file');
            }
            
            // Check if first row contains headers
            const firstRow = jsonData[0];
            const hasHeader = firstRow && firstRow[0] && firstRow[0].toString().toLowerCase().includes('index');
            const startRow = hasHeader ? 1 : 0;
            
            for (let i = startRow; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (row && row[0] && row[0].toString().trim()) {
                    students.push({
                        indexNumber: row[0].toString().trim(),
                        name: row[1] ? row[1].toString().trim() : ''
                    });
                }
            }
        }
        
        if (students.length === 0) {
            showUploadMessage('No valid student data found in file. Make sure first column contains index numbers.', 'error');
            return;
        }
        
        // Send to API
        const response = await fetch('/api/upload-classlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ students })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showUploadMessage(`✅ ${data.message} (Added: ${data.added}, Duplicates: ${data.duplicates})`, 'success');
            classListFile.value = '';
        } else {
            showUploadMessage(`❌ ${data.message}`, 'error');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showUploadMessage(`Upload failed: ${error.message}`, 'error');
    } finally {
        // Remove loading state
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = 'Upload Class List';
        uploadBtn.classList.remove('btn-loading');
    }
});

// Load Course History with loading state
document.getElementById('loadHistoryBtn')?.addEventListener('click', async () => {
    const course = document.getElementById('historyCourseSelect').value;
    const loadBtn = document.getElementById('loadHistoryBtn');
    const historyStats = document.getElementById('historyStats');
    const historyBody = document.getElementById('historyTableBody');
    
    // Show loading state
    const originalText = loadBtn.textContent;
    loadBtn.disabled = true;
    loadBtn.innerHTML = '<span class="loading-spinner"></span> Loading...';
    historyBody.innerHTML = '<tr><td colspan="4" class="empty-state">Loading history...<div class="loading-spinner" style="margin-top: 10px;"></div></td></tr>';
    
    try {
        const response = await fetch(`/api/course-history?course=${course}`);
        const data = await response.json();
        
        if (!data.success && data.error) {
            throw new Error(data.error);
        }
        
        // Update stats cards
        historyStats.style.display = 'grid';
        historyStats.innerHTML = `
            <div class="stat-card"><div class="stat-number">${data.total || 0}</div><div class="stat-label">Total Attendance</div></div>
            <div class="stat-card"><div class="stat-number">${data.unique || 0}</div><div class="stat-label">Unique Students</div></div>
            <div class="stat-card"><div class="stat-number">${data.sessions || 0}</div><div class="stat-label">Sessions</div></div>
        `;
        
        if (!data.records || data.records.length === 0) {
            historyBody.innerHTML = '<tr><td colspan="4" class="empty-state">No attendance records found for this course. Students need to mark attendance first.</td></tr>';
        } else {
            historyBody.innerHTML = data.records.map(record => `
                <tr>
                    <td>${new Date(record.timestamp).toLocaleDateString()}  ${new Date(record.timestamp).toLocaleTimeString()}</td>
                    <td>${escapeHtml(record.name)}</td>
                    <td>${record.index}</td>
                    <td>${record.sessionId || '-'}</td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading history:', error);
        historyBody.innerHTML = `<tr><td colspan="4" class="empty-state">Error: ${error.message}</td></tr>`;
        historyStats.style.display = 'none';
    } finally {
        // Remove loading state
        loadBtn.disabled = false;
        loadBtn.innerHTML = originalText;
    }
});

// Analytics variables
let weeklyChart = null;

// Load Analytics
document.getElementById('loadAnalyticsBtn')?.addEventListener('click', async () => {
    const course = document.getElementById('analyticsCourseSelect').value;
    const loading = document.getElementById('analyticsLoading');
    const results = document.getElementById('analyticsResults');
    const loadBtn = document.getElementById('loadAnalyticsBtn');
    
    // Show loading
    loadBtn.disabled = true;
    loadBtn.innerHTML = '<span class="loading-spinner"></span> Loading...';
    loading.style.display = 'block';
    results.style.display = 'none';
    
    try {
        const response = await fetch(`/api/course-analytics?course=${course}`);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error);
        }
        
        // Render summary cards
        const summaryHtml = `
            <div class="summary-card">
                <div class="value">${data.summary.totalStudents}</div>
                <div class="label">Total Students</div>
            </div>
            <div class="summary-card">
                <div class="value">${data.summary.totalWeeks}</div>
                <div class="label">Total Weeks</div>
            </div>
            <div class="summary-card">
                <div class="value">${data.summary.totalAttendance}</div>
                <div class="label">Total Records</div>
            </div>
            <div class="summary-card">
                <div class="value">${data.summary.averagePercentage}%</div>
                <div class="label">Avg Attendance</div>
            </div>
        `;
        document.getElementById('analyticsSummary').innerHTML = summaryHtml;
        
        // Render weekly trend chart
        if (weeklyChart) {
            weeklyChart.destroy();
        }
        
        const ctx = document.getElementById('weeklyChart').getContext('2d');
        weeklyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.weeklyTrend.map(w => `Week ${w.week}`),
                datasets: [{
                    label: 'Attendance %',
                    data: data.weeklyTrend.map(w => w.percentage.toFixed(1)),
                    borderColor: '#4f46e5',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: { callbacks: { label: (ctx) => `${ctx.raw}%` } }
                },
                scales: {
                    y: { beginAtZero: true, max: 100, ticks: { callback: (v) => `${v}%` } }
                }
            }
        });
        
        // Render student table
        const studentBody = document.getElementById('studentTableBody');
        studentBody.innerHTML = data.students.map(s => `
            <tr>
                <td>${escapeHtml(s.name)}</td>
                <td>${s.index}</td>
                <td>${s.present}</td>
                <td>${s.total}</td>
                <td>${s.percentage}%</td>
                <td class="status-${s.status.toLowerCase()}">${s.status === 'Good' ? 'Good' : (s.status === 'Warning' ? 'Warning' : 'At Risk')}</td>
            </tr>
        `).join('');
        
        // Show results
        results.style.display = 'block';
        
    } catch (error) {
        console.error('Analytics error:', error);
        alert('Failed to load analytics: ' + error.message);
    } finally {
        loadBtn.disabled = false;
        loadBtn.innerHTML = 'Load Analytics';
        loading.style.display = 'none';
    }
});

// Export Analytics to CSV
document.getElementById('exportAnalyticsBtn')?.addEventListener('click', () => {
    const rows = document.querySelectorAll('#studentTableBody tr');
    let csv = 'Name,Index Number,Present,Total Weeks,Percentage,Status\n';
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length) {
            csv += `"${cells[0].textContent}","${cells[1].textContent}","${cells[2].textContent}","${cells[3].textContent}","${cells[4].textContent}","${cells[5].textContent}"\n`;
        }
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics_${document.getElementById('analyticsCourseSelect').value}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
});

// Export Analytics to PDF
document.getElementById('exportAnalyticsPdfBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('exportAnalyticsPdfBtn');
    const originalText = btn.innerHTML;
    
    // Check if analytics data is loaded
    const analyticsResults = document.getElementById('analyticsResults');
    if (analyticsResults.style.display !== 'block') {
        alert('Please load analytics data first (click "Load Analytics")');
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner"></span> Generating PDF...';
    
    try {
        // Get course name
        const courseSelect = document.getElementById('analyticsCourseSelect');
        const courseName = courseSelect.options[courseSelect.selectedIndex]?.text || courseSelect.value;
        
        // Wait a moment for any pending renders
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Get the chart canvas
        const chartCanvas = document.getElementById('weeklyChart');
        if (!chartCanvas) {
            throw new Error('Chart not found');
        }
        
        // Get student table data directly from the DOM
        const studentRows = document.querySelectorAll('#studentTableBody tr');
        const studentData = [];
        studentRows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length) {
                studentData.push({
                    name: cells[0]?.textContent || '',
                    index: cells[1]?.textContent || '',
                    present: cells[2]?.textContent || '',
                    total: cells[3]?.textContent || '',
                    percent: cells[4]?.textContent || '',
                    status: cells[5]?.textContent || ''
                });
            }
        });
        
        // Get summary stats
        const summaryCards = document.querySelectorAll('#analyticsSummary .summary-card');
        const summary = {
            totalStudents: summaryCards[0]?.querySelector('.value')?.textContent || '0',
            totalWeeks: summaryCards[1]?.querySelector('.value')?.textContent || '0',
            totalAttendance: summaryCards[2]?.querySelector('.value')?.textContent || '0',
            avgPercentage: summaryCards[3]?.querySelector('.value')?.textContent || '0'
        };
        
        // Create HTML content for PDF (avoid cloning DOM issues)
        const currentDate = new Date().toLocaleString();
        
        const pdfHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Attendance Report - ${courseName}</title>
                <style>
                    body {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        padding: 40px;
                        color: #1f2937;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 30px;
                        border-bottom: 2px solid #4f46e5;
                        padding-bottom: 20px;
                    }
                    .header h1 {
                        color: #4f46e5;
                        margin-bottom: 5px;
                        font-size: 24px;
                    }
                    .header h2 {
                        color: #374151;
                        margin-bottom: 5px;
                        font-size: 18px;
                    }
                    .header p {
                        color: #6b7280;
                        font-size: 12px;
                    }
                    .summary-grid {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 15px;
                        margin-bottom: 30px;
                    }
                    .summary-card {
                        background: #f3f4f6;
                        padding: 15px;
                        text-align: center;
                        border-radius: 12px;
                    }
                    .summary-card .value {
                        font-size: 28px;
                        font-weight: 700;
                        color: #4f46e5;
                    }
                    .summary-card .label {
                        font-size: 11px;
                        color: #6b7280;
                        margin-top: 5px;
                    }
                    .section-title {
                        font-size: 16px;
                        font-weight: 600;
                        margin: 20px 0 15px 0;
                        color: #1f2937;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 11px;
                    }
                    th, td {
                        border: 1px solid #e5e7eb;
                        padding: 8px;
                        text-align: left;
                    }
                    th {
                        background-color: #f3f4f6;
                        font-weight: 600;
                    }
                    .text-center {
                        text-align: center;
                    }
                    .status-good { color: #10b981; font-weight: 600; }
                    .status-warning { color: #f59e0b; font-weight: 600; }
                    .status-danger { color: #ef4444; font-weight: 600; }
                    .footer {
                        text-align: center;
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #e5e7eb;
                        font-size: 10px;
                        color: #9ca3af;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>GroupForge Attendance Report</h1>
                    <h2>${courseName}</h2>
                    <p>Generated: ${currentDate}</p>
                </div>
                
                <div class="summary-grid">
                    <div class="summary-card">
                        <div class="value">${summary.totalStudents}</div>
                        <div class="label">Total Students</div>
                    </div>
                    <div class="summary-card">
                        <div class="value">${summary.totalWeeks}</div>
                        <div class="label">Total Weeks</div>
                    </div>
                    <div class="summary-card">
                        <div class="value">${summary.totalAttendance}</div>
                        <div class="label">Total Records</div>
                    </div>
                    <div class="summary-card">
                        <div class="value">${summary.avgPercentage}%</div>
                        <div class="label">Avg Attendance</div>
                    </div>
                </div>
                
                <div class="section-title">Student Attendance Breakdown</div>
                <table>
                    <thead>
                        <tr><th>Name</th><th>Index</th><th class="text-center">Present</th><th class="text-center">Total</th><th class="text-center">%</th><th class="text-center">Status</th></tr>
                    </thead>
                    <tbody>
                        ${studentData.map(s => `
                            <tr>
                                <td>${escapeHtml(s.name)}</td>
                                <td>${s.index}</td>
                                <td class="text-center">${s.present}</td>
                                <td class="text-center">${s.total}</td>
                                <td class="text-center">${s.percent}</td>
                                <td class="text-center status-${s.status === '✅ Good' ? 'good' : (s.status === '⚠️ Warning' ? 'warning' : 'danger')}">${s.status}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <div class="footer">
                    <p>GroupForge Attendance System • Report generated automatically</p>
                </div>
            </body>
            </html>
        `;
        
        // Create a blob and generate PDF
        const blob = new Blob([pdfHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        
        iframe.src = url;
        iframe.onload = () => {
            setTimeout(() => {
                iframe.contentWindow.print();
                URL.revokeObjectURL(url);
                document.body.removeChild(iframe);
            }, 500);
        };
        
        // Alternative: Use html2pdf with the generated HTML
        // Create a temporary div with the HTML content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = pdfHtml;
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        document.body.appendChild(tempDiv);
        
        const opt = {
            margin: [0.5, 0.5, 0.5, 0.5],
            filename: `${courseName.replace(/[^a-z0-9]/gi, '_')}_attendance_${new Date().toISOString().slice(0, 10)}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
        };
        
        await html2pdf().set(opt).from(tempDiv).save();
        
        // Clean up
        document.body.removeChild(tempDiv);
        
    } catch (error) {
        console.error('PDF generation error:', error);
        alert('Failed to generate PDF: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
});



locationToggle?.addEventListener('change', (e) => {
    locationCoords.style.display = e.target.checked ? 'block' : 'none';
});

// Get current location for classroom
document.getElementById('getCurrentLocationBtn')?.addEventListener('click', () => {
    if (!navigator.geolocation) {
        alert('Geolocation not supported');
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            document.getElementById('classLat').value = position.coords.latitude;
            document.getElementById('classLng').value = position.coords.longitude;
            alert('Classroom location set!');
        },
        (error) => {
            alert('Error getting location: ' + error.message);
        }
    );
});


// Helper function for escapeHtml (if not already defined)
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Helper functions for file reading
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('Failed to read Excel file'));
        reader.readAsArrayBuffer(file);
    });
}

function showUploadMessage(message, type) {
    uploadResult.textContent = message;
    uploadResult.className = `upload-result ${type}`;
    uploadResult.style.display = 'block';
    
    // Auto-hide after 5 seconds for success/error, keep info visible
    if (type !== 'info') {
        setTimeout(() => {
            uploadResult.style.display = 'none';
        }, 5000);
    }
}