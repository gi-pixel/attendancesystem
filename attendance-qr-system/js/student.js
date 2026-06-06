// Student page logic - handles attendance marking

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

// ========== VALIDATION FUNCTIONS ==========

function showMessage(element, text, type) {
    if (!element) return;
    element.textContent = text;
    element.className = `message ${type}`;
    setTimeout(() => {
        element.className = 'message';
    }, 5000);
}

// Validate name
function validateName(name) {
    name = name.trim();
    
    if (!name) {
        return { valid: false, message: 'Please enter your full name' };
    }
    
    if (name.length < 3) {
        return { valid: false, message: 'Name must be at least 3 characters' };
    }
    
    if (name.length > 100) {
        return { valid: false, message: 'Name is too long (maximum 100 characters)' };
    }
    
    return { valid: true, message: '' };
}

// Validate index number (exactly 8-10 digits)
function validateIndexNumber(index) {
    index = index.trim();
    
    if (!index) {
        return { valid: false, message: 'Please enter your index number' };
    }
    
    if (!/^\d+$/.test(index)) {
        return { valid: false, message: 'Index number must contain only digits' };
    }
    
    if (index.length < 8) {
        return { valid: false, message: 'Index number is too short (minimum 8 digits)' };
    }
    
    if (index.length > 10) {
        return { valid: false, message: 'Index number is too long (maximum 10 digits)' };
    }
    
    return { valid: true, message: '' };
}

// Show field error under input
function showFieldError(field, message) {
    const parent = field.parentElement;
    const existingError = parent.querySelector('.field-error');
    if (existingError) existingError.remove();
    
    if (message) {
        field.style.borderColor = '#ef4444';
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.textContent = message;
        errorDiv.style.cssText = 'color: #ef4444; font-size: 0.7rem; margin-top: 0.25rem;';
        parent.appendChild(errorDiv);
    } else {
        field.style.borderColor = '';
    }
}

// Clear all field errors
function clearFieldErrors() {
    if (studentName) showFieldError(studentName, '');
    if (studentIndex) showFieldError(studentIndex, '');
}

// Real-time validation as user types
function setupRealTimeValidation() {
    if (studentName) {
        studentName.addEventListener('input', function() {
            const result = validateName(this.value);
            showFieldError(this, result.valid ? '' : result.message);
        });
    }
    
    if (studentIndex) {
        studentIndex.addEventListener('input', function() {
            const result = validateIndexNumber(this.value);
            showFieldError(this, result.valid ? '' : result.message);
        });
    }
}

// ========== SESSION STATUS ==========

async function checkSessionStatus() {
    if (!sessionId) {
        sessionInfo.innerHTML = '<span>❌ Invalid session link</span>';
        submitBtn.disabled = true;
        return;
    }
    
    try {
        const response = await fetch(`/api/session-status?session=${sessionId}`);
        const data = await response.json();
        
        if (!data.active) {
            sessionInfo.innerHTML = '<span>🔴 Session Closed - Attendance no longer accepted</span>';
            submitBtn.disabled = true;
            if (messageDiv) showMessage(messageDiv, 'This attendance session has closed.', 'error');
        } else if (data.expiresIn) {
            const minutesLeft = Math.floor(data.expiresIn / 60000);
            sessionInfo.innerHTML = `<span>🟢 Session Active • Expires in ${minutesLeft} minutes</span>`;
        }
    } catch (error) {
        console.error('Session check failed:', error);
        sessionInfo.innerHTML = '<span>⚠️ Unable to check session status</span>';
    }
}

// ========== VERIFY STUDENT ==========

async function verifyStudent(index) {
    try {
        const response = await fetch('/api/verify-student', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index: index })
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Verification error:', error);
        return { valid: false, message: 'Verification failed. Please try again.' };
    }
}

// ========== SUBMIT ATTENDANCE ==========

async function submitAttendance() {
    const name = studentName.value.trim();
    const index = studentIndex.value.trim();
    
    // Validate name
    const nameValidation = validateName(name);
    if (!nameValidation.valid) {
        showMessage(messageDiv, nameValidation.message, 'error');
        studentName.focus();
        return;
    }
    
    // Validate index number
    const indexValidation = validateIndexNumber(index);
    if (!indexValidation.valid) {
        showMessage(messageDiv, indexValidation.message, 'error');
        studentIndex.focus();
        return;
    }
    
    if (!sessionId) {
        showMessage(messageDiv, 'Invalid session. Please scan QR code again.', 'error');
        return;
    }
    
    // ========== VERIFY STUDENT IN CLASS LIST ==========
    const verification = await verifyStudent(index);
    if (!verification.valid) {
        showMessage(messageDiv, verification.message, 'error');
        return;
    }
    // ========== END VERIFICATION ==========
    
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
            showMessage(messageDiv, `✅ Attendance recorded for ${name}`, 'success');
            studentName.value = '';
            studentIndex.value = '';
            clearFieldErrors();
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

// ========== EVENT LISTENERS ==========

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

// Initialize
setupRealTimeValidation();
checkSessionStatus();