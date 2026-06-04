const studentName = document.getElementById('studentName');
const studentIndex = document.getElementById('studentIndex');
const submitBtn = document.getElementById('submitBtn');
const messageDiv = document.getElementById('message');
const sessionInfo = document.getElementById('sessionInfo');
const courseDisplay = document.getElementById('courseDisplay');

// Get session from URL
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session');
const courseFromUrl = urlParams.get('course');

// Display course name
if (courseFromUrl && courseDisplay) {
    const courseNames = {
        'CS101': 'Computer Science 101',
        'MATH201': 'Mathematics 201',
        'ENG101': 'English 101',
        'PHYS101': 'Physics 101',
        'CHEM101': 'Chemistry 101',
        'BUS101': 'Business 101'
    };
    courseDisplay.value = courseNames[courseFromUrl] || courseFromUrl;
}

function showMessage(element, text, type) {
    if (!element) return;
    element.textContent = text;
    element.className = `message ${type}`;
    setTimeout(() => {
        element.className = 'message';
    }, 5000);
}

// Check session status on load
async function checkSessionStatus() {
    if (!sessionId) {
        sessionInfo.innerHTML = '<span> Invalid session link</span>';
        submitBtn.disabled = true;
        return;
    }
    
    try {
        const response = await fetch(`/api/session-status?session=${sessionId}`);
        const data = await response.json();
        
        if (!data.active) {
            sessionInfo.innerHTML = '<span> Session Closed - Attendance no longer accepted</span>';
            submitBtn.disabled = true;
            if (messageDiv) showMessage(messageDiv, 'This attendance session has closed.', 'error');
        } else if (data.expiresIn) {
            const minutesLeft = Math.floor(data.expiresIn / 60000);
            sessionInfo.innerHTML = `<span> Session Active • Expires in ${minutesLeft} minutes</span>`;
        }
    } catch (error) {
        console.error('Session check failed:', error);
        sessionInfo.innerHTML = '<span> Unable to check session status</span>';
    }
}

// Submit attendance
async function submitAttendance() {
    const name = studentName.value.trim();
    const index = studentIndex.value.trim();
    
    // Validation
    if (!name) {
        showMessage(messageDiv, 'Please enter your full name', 'error');
        studentName.focus();
        return;
    }
    
    if (!index) {
        showMessage(messageDiv, 'Please enter your index number', 'error');
        studentIndex.focus();
        return;
    }
    
    if (!sessionId) {
        showMessage(messageDiv, 'Invalid session. Please scan QR code again.', 'error');
        return;
    }
    
    // Disable button during submission
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    showMessage(messageDiv, 'Recording attendance...', 'info');
    
    try {
        const response = await fetch('/api/mark-attendance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sessionId: sessionId,
                course: courseFromUrl,
                name: name,
                index: index,
                timestamp: new Date().toISOString()
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showMessage(messageDiv, ` Attendance recorded for ${name}`, 'success');
            studentName.value = '';
            studentIndex.value = '';
        } else {
            showMessage(messageDiv, data.message || 'Failed to record attendance', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showMessage(messageDiv, 'Network error. Please check your connection.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Attendance';
    }
}

// Event listeners
if (submitBtn) {
    submitBtn.addEventListener('click', submitAttendance);
}

// Enter key support
if (studentIndex) {
    studentIndex.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitAttendance();
    });
}

if (studentName) {
    studentName.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitAttendance();
    });
}

// Check session status on load
checkSessionStatus();