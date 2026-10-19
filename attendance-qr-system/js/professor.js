// ============================================================
// GLOBAL STATE
// ============================================================
let courseNames = {};            // { CCS304: "Telecommunication Networks", ... }
let coursesLoaded = false;       // ensures we only fetch once per session
let qrcode = null;
let weeklyChart = null;
let allAssignments = [];
let isVerified = false;

// ============================================================
// UTILITIES
// ============================================================
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    document.body.appendChild(alertDiv);
    setTimeout(() => alertDiv.remove(), 3000);
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Failed to read Excel file'));
        reader.readAsArrayBuffer(file);
    });
}

// ============================================================
// COURSES FETCH (bootstrap everything)
// ============================================================
async function fetchCourses() {
    if (coursesLoaded) return;
    try {
        const res = await fetch('/api/courses');
        const data = await res.json();
        if (data.success && Array.isArray(data.courses)) {
            courseNames = {};
            data.courses.forEach(c => { courseNames[c.code] = c.name; });
            coursesLoaded = true;
            populateAllCourseDropdowns(data.courses);
            renderCoursesTable(data.courses);
        } else {
            console.error('Courses fetch returned error:', data);
        }
    } catch (err) {
        console.error('Failed to fetch courses:', err);
    }
}

function populateAllCourseDropdowns(courses) {
    // All selects with class .dynamic-course-select that expect a "first option" (e.g. All Courses)
    const selects = document.querySelectorAll('.dynamic-course-select');

    selects.forEach(sel => {
        // Preserve the first option if it's an "All" filter
        const firstOption = sel.querySelector('option');
        const isAllFilter = firstOption && firstOption.value === '';
        const preserveFirst = isAllFilter ? firstOption.outerHTML : '';
        const placeholder = preserveFirst || `<option value="">Select a course</option>`;

        sel.innerHTML = placeholder + courses.map(c =>
            `<option value="${escapeHtml(c.code)}">${escapeHtml(c.name)}</option>`
        ).join('');
    });
}

// ============================================================
// LOGIN
// ============================================================
async function checkPassword() {
    if (sessionStorage.getItem('professor_auth') === 'true') {
        document.getElementById('passwordModal').style.display = 'none';
        document.getElementById('dashboardContent').style.display = 'block';
        isVerified = true;
        await fetchCourses();
        return;
    }
    document.getElementById('passwordModal').style.display = 'flex';
    document.getElementById('dashboardContent').style.display = 'none';
}

async function verifyPassword() {
    const passwordInput = document.getElementById('professorPassword');
    const errorDiv = document.getElementById('passwordError');
    const password = passwordInput.value.trim();

    if (!password) { errorDiv.textContent = 'Please enter password'; return; }
    errorDiv.textContent = 'Verifying...';

    try {
        const res = await fetch('/api/courses');
        const data = await res.json();

        if (data.professor_password === password) {
            sessionStorage.setItem('professor_auth', 'true');
            document.getElementById('passwordModal').style.display = 'none';
            document.getElementById('dashboardContent').style.display = 'block';
            errorDiv.textContent = '';
            passwordInput.value = '';
            isVerified = true;

            // Load courses + populate
            courseNames = {};
            (data.courses || []).forEach(c => { courseNames[c.code] = c.name; });
            coursesLoaded = true;
            populateAllCourseDropdowns(data.courses || []);
            renderCoursesTable(data.courses || []);
        } else {
            errorDiv.textContent = 'Incorrect password. Please try again.';
            passwordInput.value = '';
            passwordInput.focus();
        }
    } catch (err) {
        console.error('Password verification error:', err);
        errorDiv.textContent = 'Error verifying password. Please try again.';
    }
}

document.getElementById('verifyPasswordBtn')?.addEventListener('click', verifyPassword);
document.getElementById('professorPassword')?.addEventListener('keypress', e => {
    if (e.key === 'Enter') verifyPassword();
});
checkPassword();

// ============================================================
// TAB NAVIGATION
// ============================================================
const tabs = document.querySelectorAll('.tab-btn');
const panes = document.querySelectorAll('.tab-pane');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabId = tab.dataset.tab;
        tabs.forEach(t => t.classList.remove('active'));
        panes.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`tab-${tabId}`).classList.add('active');

        // Lazy-load per tab
        if (tabId === 'sessions') loadSessionsTab();
        if (tabId === 'courses') { renderCoursesTableFromCache(); }
        if (tabId === 'assignments') loadAssignments();
    });
});

// ============================================================
// GENERATE QR
// ============================================================
const generateBtn = document.getElementById('generateBtn');
const qrResult = document.getElementById('qrResult');
const courseSelect = document.getElementById('courseSelect');
const sessionDuration = document.getElementById('sessionDuration');

generateBtn?.addEventListener('click', async () => {
    const course = courseSelect.value;
    const duration = parseInt(sessionDuration.value);

    if (!course) { alert('Please select a course'); return; }

    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';

    try {
        const res = await fetch('/api/generate-qr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ course, duration })
        });
        const data = await res.json();

        if (data.success) {
            if (qrcode) document.getElementById('qrcode').innerHTML = '';
            const attendanceUrl = `${window.location.origin}/index.html?session=${data.sessionId}&course=${course}`;
            qrcode = new QRCode(document.getElementById('qrcode'), {
                text: attendanceUrl, width: 200, height: 200
            });

            document.getElementById('qrCourse').textContent = courseNames[course] || course;
            document.getElementById('qrSessionId').textContent = data.sessionId;
            document.getElementById('qrExpiry').textContent = new Date(data.expiresAt).toLocaleTimeString();
            qrResult.style.display = 'block';
            qrResult.scrollIntoView({ behavior: 'smooth' });
        } else {
            alert('Failed to generate QR: ' + (data.message || 'Unknown error'));
        }
    } catch (err) {
        alert('Error generating QR code');
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate QR Code';
    }
});

document.getElementById('copyLinkBtn')?.addEventListener('click', () => {
    const course = courseSelect.value;
    const sessionId = document.getElementById('qrSessionId').textContent;
    const url = `${window.location.origin}/index.html?session=${sessionId}&course=${course}`;
    navigator.clipboard.writeText(url);
    const msg = document.getElementById('copyMessage');
    msg.textContent = '✓ Link copied to clipboard!';
    setTimeout(() => msg.textContent = '', 3000);
});

// ============================================================
// SESSIONS TAB (MERGED: live + today)
// ============================================================
let sessionsLoaded = false;

async function loadSessionsTab() {
    await Promise.all([loadLiveSessions(), loadTodayRecords()]);
    sessionsLoaded = true;
}

document.getElementById('refreshSessionsBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('refreshSessionsBtn');
    btn.disabled = true;
    btn.textContent = 'Refreshing...';
    await loadSessionsTab();
    btn.disabled = false;
    btn.textContent = 'Refresh';
});

async function loadLiveSessions() {
    const loading = document.getElementById('sessionsLoading');
    const wrapper = document.getElementById('sessionsTableWrapper');
    const tbody = document.getElementById('sessionsTableBody');
    const liveCount = document.getElementById('liveCount');

    loading.style.display = 'block';
    wrapper.style.display = 'none';

    try {
        const res = await fetch('/api/active-sessions');
        const data = await res.json();
        const sessions = data.sessions || [];

        liveCount.textContent = `(${sessions.length})`;

        if (sessions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No active sessions</td></tr>';
        } else {
            tbody.innerHTML = sessions.map(s => {
                const expiresAt = new Date(s.expiresAt);
                const timeLeft = expiresAt - new Date();
                const m = Math.floor(timeLeft / 60000);
                const sec = Math.floor((timeLeft % 60000) / 1000);
                const timeText = timeLeft > 0 ? `${m}m ${sec}s` : 'Expired';
                const locText = s.requireLocation === 'YES' ? '📍 Yes' : 'No';
                return `
                    <tr>
                        <td><strong>${escapeHtml(courseNames[s.course] || s.course)}</strong></td>
                        <td><code style="font-size: 0.7rem;">${escapeHtml(s.sessionId)}</code></td>
                        <td>${expiresAt.toLocaleTimeString()}</td>
                        <td class="${timeLeft < 60000 ? 'status-danger' : 'status-good'}">${timeText}</td>
                        <td>${locText}</td>
                        <td>
                            <button class="btn-delete-session" data-session="${escapeHtml(s.sessionId)}" data-course="${escapeHtml(s.course)}">❌ Close</button>
                        </td>
                    </tr>`;
            }).join('');
        }

        wrapper.style.display = 'block';

        document.querySelectorAll('.btn-delete-session').forEach(btn => {
            btn.addEventListener('click', async () => {
                const sessionId = btn.getAttribute('data-session');
                const course = btn.getAttribute('data-course');
                if (confirm(`Close session for ${courseNames[course] || course}?`)) {
                    await closeSession(sessionId);
                    await loadLiveSessions();   // refresh only live list
                }
            });
        });
    } catch (err) {
        console.error('Error loading live sessions:', err);
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Error loading sessions</td></tr>';
        wrapper.style.display = 'block';
    } finally {
        loading.style.display = 'none';
    }
}

async function loadTodayRecords() {
    const loading = document.getElementById('todayLoading');
    const stats = document.getElementById('todayStats');
    const wrapper = document.getElementById('todayTableWrapper');
    const tbody = document.getElementById('attendanceTableBody');
    const totalSpan = document.getElementById('totalToday');
    const uniqueSpan = document.getElementById('uniqueToday');
    const todayCount = document.getElementById('todayCount');

    loading.style.display = 'block';
    wrapper.style.display = 'none';
    stats.style.display = 'none';

    try {
        const res = await fetch('/api/today-attendance');
        const data = await res.json();

        totalSpan.textContent = data.total || 0;
        uniqueSpan.textContent = data.unique || 0;
        todayCount.textContent = `(${data.total || 0} total, ${data.unique || 0} unique)`;

        if (!data.records || data.records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No records today</td></tr>';
        } else {
            tbody.innerHTML = data.records.map(r => `
                <tr>
                    <td>${new Date(r.timestamp).toLocaleTimeString()}</td>
                    <td>${escapeHtml(courseNames[r.course] || r.course)}</td>
                    <td>${escapeHtml(r.name)}</td>
                    <td>${escapeHtml(r.index)}</td>
                </tr>`).join('');
        }

        stats.style.display = 'grid';
        wrapper.style.display = 'block';
    } catch (err) {
        console.error('Error loading today records:', err);
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Error loading data</td></tr>';
        stats.style.display = 'grid';
        wrapper.style.display = 'block';
    } finally {
        loading.style.display = 'none';
    }
}

async function closeSession(sessionId) {
    try {
        await fetch('/api/close-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
        });
        showAlert('Session closed', 'success');
    } catch (err) {
        console.error(err);
        showAlert('Failed to close session', 'error');
    }
}

// Export today CSV
document.getElementById('exportTodayBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('exportTodayBtn');
    btn.disabled = true;
    const original = btn.innerHTML;
    btn.innerHTML = '<span class="loading-spinner"></span> Exporting...';

    try {
        const res = await fetch('/api/today-attendance');
        const data = await res.json();
        if (!data.records || data.records.length === 0) {
            alert('No records to export');
            return;
        }
        let csv = 'Timestamp,Course,Name,Index Number\n';
        data.records.forEach(r => {
            csv += `"${r.timestamp}","${courseNames[r.course] || r.course}","${r.name}","${r.index}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (err) {
        alert('Export failed');
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
});

// ============================================================
// STUDENTS TAB (upload)
// ============================================================
document.getElementById('uploadClassListBtn')?.addEventListener('click', async () => {
    const fileInput = document.getElementById('classListFile');
    const btn = document.getElementById('uploadClassListBtn');
    const result = document.getElementById('uploadResult');
    const file = fileInput.files[0];
    if (!file) { showUpload(result, 'Please select a file', 'error'); return; }

    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
        showUpload(result, 'Unsupported file type', 'error'); return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner"></span> Uploading...';
    showUpload(result, 'Processing file...', 'info');

    try {
        let students = [];

        if (ext === 'csv') {
            const text = await readFileAsText(file);
            const lines = text.split('\n');
            const start = lines[0].toLowerCase().includes('index') ? 1 : 0;
            for (let i = start; i < lines.length; i++) {
                const v = lines[i].split(',');
                if (v.length >= 1 && v[0] && v[0].trim()) {
                    students.push({ indexNumber: v[0].trim(), name: v[1] ? v[1].trim() : '' });
                }
            }
        } else {
            if (typeof XLSX === 'undefined') throw new Error('Excel parser not loaded');
            const buf = await readFileAsArrayBuffer(file);
            const wb = XLSX.read(buf, { type: 'array' });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
            const start = rows[0] && rows[0][0] && rows[0][0].toString().toLowerCase().includes('index') ? 1 : 0;
            for (let i = start; i < rows.length; i++) {
                const r = rows[i];
                if (r && r[0] && r[0].toString().trim()) {
                    students.push({ indexNumber: r[0].toString().trim(), name: r[1] ? r[1].toString().trim() : '' });
                }
            }
        }

        if (students.length === 0) { showUpload(result, 'No valid data in file', 'error'); return; }

        const res = await fetch('/api/upload-classlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ students })
        });
        const data = await res.json();

        if (data.success) {
            showUpload(result, `✅ ${data.message} (Added: ${data.added}, Duplicates: ${data.duplicates})`, 'success');
            fileInput.value = '';
        } else {
            showUpload(result, `❌ ${data.message}`, 'error');
        }
    } catch (err) {
        showUpload(result, `Upload failed: ${err.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Upload Class List';
    }
});

function showUpload(el, message, type) {
    el.textContent = message;
    el.className = `upload-result ${type}`;
    el.style.display = 'block';
    if (type !== 'info') setTimeout(() => el.style.display = 'none', 5000);
}

// ============================================================
// ANALYTICS TAB
// ============================================================
document.getElementById('loadAnalyticsBtn')?.addEventListener('click', async () => {
    const course = document.getElementById('analyticsCourseSelect').value;
    if (!course) { alert('Select a course'); return; }

    const loading = document.getElementById('analyticsLoading');
    const results = document.getElementById('analyticsResults');
    const btn = document.getElementById('loadAnalyticsBtn');

    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner"></span> Loading...';
    loading.style.display = 'block';
    results.style.display = 'none';

    try {
        const res = await fetch(`/api/course-analytics?course=${course}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Failed to load');

        document.getElementById('analyticsSummary').innerHTML = `
            <div class="summary-card"><div class="value">${data.summary.totalStudents}</div><div class="label">Total Students</div></div>
            <div class="summary-card"><div class="value">${data.summary.totalWeeks}</div><div class="label">Total Weeks</div></div>
            <div class="summary-card"><div class="value">${data.summary.totalAttendance}</div><div class="label">Total Records</div></div>
            <div class="summary-card"><div class="value">${data.summary.averagePercentage}%</div><div class="label">Avg Attendance</div></div>
        `;

        if (weeklyChart) weeklyChart.destroy();
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
                plugins: { legend: { position: 'top' } },
                scales: { y: { beginAtZero: true, max: 100, ticks: { callback: v => `${v}%` } } }
            }
        });

        document.getElementById('studentTableBody').innerHTML = data.students.map(s => `
            <tr>
                <td>${escapeHtml(s.name)}</td>
                <td>${escapeHtml(s.index)}</td>
                <td>${s.present}</td>
                <td>${s.total}</td>
                <td>${s.percentage}%</td>
                <td class="status-${s.status.toLowerCase()}">${s.status}</td>
            </tr>
        `).join('');

        results.style.display = 'block';
    } catch (err) {
        alert('Failed to load analytics: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Load Analytics';
        loading.style.display = 'none';
    }
});

document.getElementById('exportAnalyticsBtn')?.addEventListener('click', () => {
    const rows = document.querySelectorAll('#studentTableBody tr');
    let csv = 'Name,Index,Present,Total,Percentage,Status\n';
    rows.forEach(r => {
        const c = r.querySelectorAll('td');
        if (c.length) csv += `"${c[0].textContent}","${c[1].textContent}","${c[2].textContent}","${c[3].textContent}","${c[4].textContent}","${c[5].textContent}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics_${document.getElementById('analyticsCourseSelect').value}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
});

document.getElementById('exportAnalyticsPdfBtn')?.addEventListener('click', async () => {
    const results = document.getElementById('analyticsResults');
    if (results.style.display !== 'block') { alert('Load analytics first'); return; }

    const btn = document.getElementById('exportAnalyticsPdfBtn');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner"></span> Generating PDF...';

    try {
        const courseSelect = document.getElementById('analyticsCourseSelect');
        const courseName = courseSelect.options[courseSelect.selectedIndex]?.text || courseSelect.value;

        const studentRows = document.querySelectorAll('#studentTableBody tr');
        const students = [];
        studentRows.forEach(r => {
            const c = r.querySelectorAll('td');
            if (c.length) students.push({
                name: c[0].textContent, index: c[1].textContent,
                present: c[2].textContent, total: c[3].textContent,
                percent: c[4].textContent, status: c[5].textContent
            });
        });

        const summaryCards = document.querySelectorAll('#analyticsSummary .summary-card');
        const summary = {
            totalStudents: summaryCards[0]?.querySelector('.value')?.textContent || '0',
            totalWeeks: summaryCards[1]?.querySelector('.value')?.textContent || '0',
            totalAttendance: summaryCards[2]?.querySelector('.value')?.textContent || '0',
            avgPercentage: summaryCards[3]?.querySelector('.value')?.textContent || '0'
        };

        const html = `
            <!DOCTYPE html><html><head><meta charset="UTF-8">
            <style>
                body{font-family:Inter,sans-serif;padding:40px;color:#1f2937}
                .header{text-align:center;margin-bottom:30px;border-bottom:2px solid #4f46e5;padding-bottom:20px}
                .header h1{color:#4f46e5}
                .summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:15px;margin-bottom:30px}
                .summary-card{background:#f3f4f6;padding:15px;text-align:center;border-radius:12px}
                .summary-card .value{font-size:28px;font-weight:700;color:#4f46e5}
                .summary-card .label{font-size:11px;color:#6b7280}
                table{width:100%;border-collapse:collapse;font-size:11px}
                th,td{border:1px solid #e5e7eb;padding:8px;text-align:left}
                th{background:#f3f4f6}
                .text-center{text-align:center}
                .status-good{color:#10b981;font-weight:600}
                .status-warning{color:#f59e0b;font-weight:600}
                .status-danger{color:#ef4444;font-weight:600}
            </style></head><body>
                <div class="header">
                    <h1>ClassTrack Attendance Report</h1>
                    <h2>${courseName}</h2>
                    <p>Generated: ${new Date().toLocaleString()}</p>
                </div>
                <div class="summary-grid">
                    <div class="summary-card"><div class="value">${summary.totalStudents}</div><div class="label">Total Students</div></div>
                    <div class="summary-card"><div class="value">${summary.totalWeeks}</div><div class="label">Total Weeks</div></div>
                    <div class="summary-card"><div class="value">${summary.totalAttendance}</div><div class="label">Total Records</div></div>
                    <div class="summary-card"><div class="value">${summary.avgPercentage}%</div><div class="label">Avg Attendance</div></div>
                </div>
                <table><thead><tr><th>Name</th><th>Index</th><th class="text-center">Present</th><th class="text-center">Total</th><th class="text-center">%</th><th class="text-center">Status</th></tr></thead>
                <tbody>${students.map(s => `
                    <tr><td>${escapeHtml(s.name)}</td><td>${s.index}</td>
                    <td class="text-center">${s.present}</td><td class="text-center">${s.total}</td>
                    <td class="text-center">${s.percent}</td>
                    <td class="text-center status-${s.status === 'Good' ? 'good' : s.status === 'Warning' ? 'warning' : 'danger'}">${s.status}</td></tr>
                `).join('')}</tbody></table>
            </body></html>`;

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        document.body.appendChild(tempDiv);

        await html2pdf().set({
            margin: [0.5, 0.5, 0.5, 0.5],
            filename: `${courseName.replace(/[^a-z0-9]/gi, '_')}_attendance_${new Date().toISOString().slice(0, 10)}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
        }).from(tempDiv).save();

        document.body.removeChild(tempDiv);
    } catch (err) {
        alert('PDF generation failed: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
});

// ============================================================
// ASSIGNMENTS TAB
// ============================================================
document.getElementById('assignmentsFilterCourse')?.addEventListener('change', loadAssignments);
document.getElementById('assignmentsFilterType')?.addEventListener('change', loadAssignments);

async function loadAssignments() {
    const course = document.getElementById('assignmentsFilterCourse').value;
    const type = document.getElementById('assignmentsFilterType').value;
    const loading = document.getElementById('assignmentsLoading');
    const wrapper = document.getElementById('assignmentsTableWrapper');
    const tbody = document.getElementById('assignmentsTableBody');

    loading.style.display = 'block';
    wrapper.style.display = 'none';

    try {
        const params = new URLSearchParams();
        if (course) params.append('course', course);
        if (type) params.append('type', type);
        const url = '/api/assignments' + (params.toString() ? `?${params}` : '');

        const res = await fetch(url);
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Failed to load');

        allAssignments = data.assignments || [];

        if (allAssignments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No assignments or announcements found.</td></tr>';
        } else {
            tbody.innerHTML = allAssignments.map(a => {
                const due = a.dueDate ? new Date(a.dueDate).toLocaleDateString() : '—';
                return `
                    <tr>
                        <td><strong>${escapeHtml(a.title)}</strong></td>
                        <td>${escapeHtml(courseNames[a.course] || a.course)}</td>
                        <td style="text-transform: capitalize;">${escapeHtml(a.type)}</td>
                        <td>${due}</td>
                        <td>${getStatusBadge(a)}</td>
                        <td>
                            <button class="btn-delete-session" data-id="${escapeHtml(a.id)}" style="background: var(--danger);">Delete</button>
                        </td>
                    </tr>`;
            }).join('');
        }
        wrapper.style.display = 'block';
    } catch (err) {
        console.error('Error loading assignments:', err);
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Error: ${escapeHtml(err.message)}</td></tr>`;
        wrapper.style.display = 'block';
    } finally {
        loading.style.display = 'none';
    }
}

function getStatusBadge(a) {
    const now = new Date();
    const due = a.dueDate ? new Date(a.dueDate) : null;
    let text = a.status || 'pending';
    let color = 'var(--text-muted)';

    if (a.type === 'announcement') {
        text = '📢 Announcement'; color = 'var(--primary-500)';
    } else if (a.type !== 'assignment') {
        text = `📌 ${a.type.charAt(0).toUpperCase() + a.type.slice(1)}`; color = 'var(--warning)';
    } else if (due) {
        const diff = due - now;
        if (diff < 0) { text = '🔴 Overdue'; color = 'var(--danger)'; }
        else if (diff < 86400000 * 2) { const d = Math.ceil(diff / 86400000); text = `🟡 ${d} day${d > 1 ? 's' : ''} left`; color = 'var(--warning)'; }
        else { const d = Math.ceil(diff / 86400000); text = `🟢 ${d} days left`; color = 'var(--success)'; }
    }
    return `<span style="color:${color};font-weight:500;">${text}</span>`;
}

document.getElementById('createAssignmentBtn')?.addEventListener('click', () => {
    const modal = document.createElement('div');
    modal.className = 'password-modal';
    modal.id = 'assignmentModal';

    // Build course options from current courseNames
    const courseOpts = Object.entries(courseNames).map(([code, name]) =>
        `<option value="${escapeHtml(code)}">${escapeHtml(name)}</option>`
    ).join('');

    modal.innerHTML = `
        <div class="password-card" style="max-width:500px;">
            <div class="password-header">
                <h2>New Assignment / Update</h2>
                <p>Fill in the details below</p>
            </div>
            <div class="password-body">
                <div class="form-group">
                    <label>Course</label>
                    <select id="assignCourse" style="width:100%;padding:0.5rem;border:1.5px solid var(--border-main);border-radius:var(--radius-md);background:var(--bg-elevated);color:var(--text-primary);">
                        ${courseOpts}
                    </select>
                </div>
                <div class="form-group">
                    <label>Type</label>
                    <select id="assignType" style="width:100%;padding:0.5rem;border:1.5px solid var(--border-main);border-radius:var(--radius-md);background:var(--bg-elevated);color:var(--text-primary);">
                        <option value="assignment">Assignment</option>
                        <option value="announcement">Announcement</option>
                        <option value="midsem">Midsem</option>
                        <option value="test">Test</option>
                        <option value="presentation">Presentation</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Title</label>
                    <input type="text" id="assignTitle" placeholder="Enter title" style="width:100%;padding:0.5rem;border:1.5px solid var(--border-main);border-radius:var(--radius-md);background:var(--bg-elevated);color:var(--text-primary);">
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea id="assignDescription" rows="3" style="width:100%;padding:0.5rem;border:1.5px solid var(--border-main);border-radius:var(--radius-md);background:var(--bg-elevated);color:var(--text-primary);font-family:var(--font-sans);"></textarea>
                </div>
                <div class="form-group">
                    <label>Due Date <span style="color:var(--text-muted);font-weight:400;">(required for assignments only)</span></label>
                    <input type="date" id="assignDueDate" style="width:100%;padding:0.5rem;border:1.5px solid var(--border-main);border-radius:var(--radius-md);background:var(--bg-elevated);color:var(--text-primary);">
                </div>
                <button id="saveAssignmentBtn" class="btn-primary" style="width:100%;">Create</button>
                <button id="closeAssignmentModal" style="margin-top:0.5rem;background:none;border:none;color:var(--text-muted);cursor:pointer;width:100%;text-align:center;">Cancel</button>
            </div>
        </div>`;
    document.body.appendChild(modal);

    document.getElementById('closeAssignmentModal').addEventListener('click', () => modal.remove());

    document.getElementById('saveAssignmentBtn').addEventListener('click', async function () {
        const course = document.getElementById('assignCourse').value;
        const type = document.getElementById('assignType').value;
        const title = document.getElementById('assignTitle').value.trim();
        const description = document.getElementById('assignDescription').value.trim();
        const dueDate = document.getElementById('assignDueDate').value;

        if (!title || !description) { alert('Title and description are required'); return; }
        if (type === 'assignment' && !dueDate) { alert('Due date required for assignments'); return; }

        this.disabled = true;
        this.textContent = 'Saving...';

        try {
            const res = await fetch('/api/assignments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ course, title, description, dueDate, type })
            });
            const data = await res.json();
            if (data.success) {
                alert('Created successfully');
                modal.remove();
                loadAssignments();
            } else {
                alert('Error: ' + (data.error || 'Unknown'));
            }
        } catch (err) {
            alert('Network error: ' + err.message);
        } finally {
            this.disabled = false;
            this.textContent = 'Create';
        }
    });
});

document.getElementById('assignmentsTableBody')?.addEventListener('click', async e => {
    const btn = e.target.closest('.btn-delete-session');
    if (!btn) return;
    const id = btn.dataset.id;
    if (!confirm('Delete this entry?')) return;
    try {
        const res = await fetch(`/api/assignments?id=${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) loadAssignments();
        else alert('Delete failed: ' + data.error);
    } catch (err) {
        alert('Network error');
    }
});

// ============================================================
// COURSES TAB
// ============================================================
let currentCourses = [];

function renderCoursesTable(courses) {
    currentCourses = courses || [];
    const tbody = document.getElementById('coursesTableBody');
    const wrapper = document.getElementById('coursesTableWrapper');
    if (!tbody) return;

    if (currentCourses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="empty-state">No courses yet. Add one above.</td></tr>';
    } else {
        tbody.innerHTML = currentCourses.map(c => `
            <tr>
                <td><strong>${escapeHtml(c.code)}</strong></td>
                <td>${escapeHtml(c.name)}</td>
                <td>
                    <button class="btn-delete-session btn-delete-course" data-code="${escapeHtml(c.code)}" style="background: var(--danger);">Delete</button>
                </td>
            </tr>`).join('');

        document.querySelectorAll('.btn-delete-course').forEach(btn => {
            btn.addEventListener('click', async () => {
                const code = btn.dataset.code;
                if (!confirm(`Delete course ${code}? Historical records will remain, but this course will no longer appear in dropdowns.`)) return;

                btn.disabled = true;
                btn.textContent = 'Deleting...';

                try {
                    const res = await fetch(`/api/courses?code=${encodeURIComponent(code)}`, { method: 'DELETE' });
                    const data = await res.json();
                    if (data.success) {
                        showCoursesStatus(`✅ Deleted ${code}`, 'success');
                        // Refresh from API to keep in sync
                        await refreshCourses();
                    } else {
                        showCoursesStatus(`❌ ${data.error}`, 'error');
                        btn.disabled = false;
                        btn.textContent = 'Delete';
                    }
                } catch (err) {
                    showCoursesStatus(`❌ ${err.message}`, 'error');
                    btn.disabled = false;
                    btn.textContent = 'Delete';
                }
            });
        });
    }

    wrapper.style.display = 'block';
}

function renderCoursesTableFromCache() {
    renderCoursesTable(currentCourses);
}

async function refreshCourses() {
    try {
        const res = await fetch('/api/courses');
        const data = await res.json();
        if (data.success && Array.isArray(data.courses)) {
            courseNames = {};
            data.courses.forEach(c => { courseNames[c.code] = c.name; });
            populateAllCourseDropdowns(data.courses);
            renderCoursesTable(data.courses);
        }
    } catch (err) {
        console.error('Refresh courses failed:', err);
    }
}

document.getElementById('addCourseBtn')?.addEventListener('click', async () => {
    const codeInput = document.getElementById('newCourseCode');
    const nameInput = document.getElementById('newCourseName');
    const btn = document.getElementById('addCourseBtn');
    const code = codeInput.value.trim().toUpperCase();
    const name = nameInput.value.trim();

    if (!code || !name) { showCoursesStatus('Enter both code and name', 'error'); return; }

    btn.disabled = true;
    btn.textContent = 'Adding...';

    try {
        const res = await fetch('/api/courses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, name })
        });
        const data = await res.json();
        if (data.success) {
            showCoursesStatus(`✅ Added ${code}`, 'success');
            codeInput.value = '';
            nameInput.value = '';
            await refreshCourses();
        } else {
            showCoursesStatus(`❌ ${data.error || 'Failed'}`, 'error');
        }
    } catch (err) {
        showCoursesStatus(`❌ ${err.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '+ Add Course';
    }
});

function showCoursesStatus(msg, type) {
    const el = document.getElementById('coursesStatus');
    if (!el) return;
    el.textContent = msg;
    el.style.color = type === 'success' ? 'var(--success)' : 'var(--danger)';
    el.style.fontWeight = '500';
    if (type === 'success') setTimeout(() => el.textContent = '', 4000);
}

// ============================================================
// LOCATION TOGGLE
// ============================================================
document.getElementById('locationToggle')?.addEventListener('change', e => {
    document.getElementById('locationCoords').style.display = e.target.checked ? 'block' : 'none';
});

document.getElementById('getCurrentLocationBtn')?.addEventListener('click', () => {
    if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
    navigator.geolocation.getCurrentPosition(
        pos => {
            document.getElementById('classLat').value = pos.coords.latitude;
            document.getElementById('classLng').value = pos.coords.longitude;
            alert('Location set');
        },
        err => alert('Error: ' + err.message)
    );
});