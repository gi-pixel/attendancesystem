// Tab Switching
const tabs = document.querySelectorAll('.tab-btn');
const panes = document.querySelectorAll('.tab-pane');
const classListFile = document.getElementById('classListFile');
const uploadBtn = document.getElementById('uploadClassListBtn');
const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
const uploadResult = document.getElementById('uploadResult');

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

// Logout
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    sessionStorage.removeItem('professor_authenticated');
    window.location.href = '/';
});

// Load initial data
loadActiveSessions();
loadTodayAttendance();

// Refresh every 30 seconds
setInterval(() => {
    if (document.querySelector('.tab-btn[data-tab="sessions"]')?.classList.contains('active')) {
        loadActiveSessions();
    }
    if (document.querySelector('.tab-btn[data-tab="attendance"]')?.classList.contains('active')) {
        loadTodayAttendance();
    }
}, 30000);

// Load Course Dashboard
// Load Course Dashboard with loading indicator
document.getElementById('loadDashboardBtn')?.addEventListener('click', async () => {
    const course = document.getElementById('dashboardCourseSelect').value;
    const loadBtn = document.getElementById('loadDashboardBtn');
    const dashboardBody = document.getElementById('dashboardBody');
    
    // Show loading
    const originalText = loadBtn.textContent;
    loadBtn.disabled = true;
    loadBtn.innerHTML = '<span class="loading-spinner"></span> Loading...';
    dashboardBody.innerHTML = '<tr><td colspan="20" class="empty-state">Loading dashboard...</td></tr>';
    
    try {
        const response = await fetch(`/api/course-dashboard?course=${course}`);
        const data = await response.json();
        
        if (data.headers && data.rows && data.rows.length > 0) {
            renderDashboardTable(data.headers, data.rows);
        } else {
            dashboardBody.innerHTML = '<tr><td colspan="20" class="empty-state">No data available. Students need to mark attendance first.</td></tr>';
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
        dashboardBody.innerHTML = '<tr><td colspan="20" class="empty-state">Error loading dashboard. Please try again.</td></tr>';
    } finally {
        loadBtn.disabled = false;
        loadBtn.innerHTML = originalText;
    }
});

function renderDashboardTable(headers, rows) {
    // Header row
    const thead = document.getElementById('dashboardHeader');
    thead.innerHTML = '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';
    
    // Body rows
    const tbody = document.getElementById('dashboardBody');
    tbody.innerHTML = rows.map(row => {
        return '<tr>' + row.map(cell => {
            if (cell === 'TRUE' || cell === true) return '<td style="text-align: center;">✅</td>';
            if (cell === 'FALSE' || cell === false) return '<td style="text-align: center;">☐</td>';
            return `<td>${cell || '-'}</td>`;
        }).join('') + '</tr>';
    }).join('');
}

// Download CSV Template
downloadTemplateBtn?.addEventListener('click', () => {
    const template = `indexNumber,name\n20240001,Emma Thompson\n20240002,John Doe`;
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'class_list_template.csv';
    a.click();
    URL.revokeObjectURL(url);
});

// Upload CSV (with Excel support)
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
                if (values.length >= 1 && values[0].trim()) {
                    students.push({
                        indexNumber: values[0].trim(),
                        name: values[1] ? values[1].trim() : ''
                    });
                }
            }
        } else {
            // Handle Excel
            const data = await readFileAsArrayBuffer(file);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
            
            const startRow = (jsonData[0] && jsonData[0][0] && jsonData[0][0].toString().toLowerCase().includes('index')) ? 1 : 0;
            
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
            showUploadMessage('No valid student data found in file', 'error');
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
        showUploadMessage('Upload failed. Please check file format and try again.', 'error');
    } finally {
        // Remove loading state
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = 'Upload Class List';
        uploadBtn.classList.remove('btn-loading');
    }
});

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
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