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

function validateIndexNumber(index) {
    // Remove any spaces
    index = index.trim();
    
    // Check if empty
    if (!index) {
        return { valid: false, message: 'Please enter your index number' };
    }
    
    // Check if contains only digits (allow letters? adjust if your index has letters)
    if (!/^\d+$/.test(index)) {
        return { valid: false, message: 'Index number must contain only digits' };
    }
    
    // Check length (adjust min/max based on your institution)
    if (index.length < 10) {
        return { valid: false, message: 'Index number is too short (minimum 10 digits)' };
    }
    
    if (index.length > 10) {
        return { valid: false, message: 'Index number is too long (maximum 10 digits)' };
    }
    
    return { valid: true, message: '' };
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
    
    if (name.length > 60) {
        return { valid: false, message: 'Name is too long (maximum 60 characters)' };
    }
    
    return { valid: true, message: '' };
}

// Real-time validation feedback
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

function showFieldError(field, message) {
    // Remove existing error message
    const existingError = field.parentElement.querySelector('.field-error');
    if (existingError) existingError.remove();
    
    if (message) {
        field.style.borderColor = '#ef4444';
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.textContent = message;
        errorDiv.style.cssText = 'color: #ef4444; font-size: 0.7rem; margin-top: 0.25rem;';
        field.parentElement.appendChild(errorDiv);
    } else {
        field.style.borderColor = '';
    }
}


// Submit attendance
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
    
    // Rest of your submit code...
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
            showMessage(messageDiv, `Attendance recorded for ${name}`, 'success');
            studentName.value = '';
            studentIndex.value = '';
            // Clear any field errors
            showFieldError(studentName, '');
            showFieldError(studentIndex, '');
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
setupRealTimeValidation();