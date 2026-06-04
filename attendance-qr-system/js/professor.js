
// Tab Switching
    const tabs = document.querySelectorAll('.tab-btn');
    const panes = document.querySelectorAll('.tab-pane');

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
        if (document.querySelector('.tab-btn[data-tab="sessions"]').classList.contains('active')) {
            loadActiveSessions();
        }
        if (document.querySelector('.tab-btn[data-tab="attendance"]').classList.contains('active')) {
            loadTodayAttendance();
        }
    }, 30000);
