// Student page logic - handles attendance marking

const studentName = document.getElementById('studentName');
const studentIndex = document.getElementById('studentIndex');
const submitBtn = document.getElementById('submitBtn');
const messageDiv = document.getElementById('message');
const sessionInfo = document.getElementById('sessionInfo');
const courseDisplay = document.getElementById('courseDisplay');

let userLocation = null;
let locationRequired = false;
let classroomLocation = null;

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

// Countdown Timer
let countdownInterval = null;

function startCountdown(expiresAt) {
    const countdownDiv = document.getElementById('countdownTimer');
    const countdownDisplay = document.getElementById('countdownDisplay');
    
    if (!countdownDiv || !countdownDisplay) return;
    
    countdownDiv.style.display = 'block';
    
    if (countdownInterval) clearInterval(countdownInterval);
    
    function updateCountdown() {
        const now = new Date().getTime();
        const expiry = new Date(expiresAt).getTime();
        const distance = expiry - now;
        
        if (distance <= 0) {
            clearInterval(countdownInterval);
            countdownDisplay.textContent = 'Expired';
            countdownDisplay.classList.add('countdown-warning');
            submitBtn.disabled = true;
            sessionInfo.innerHTML = '<span>🔴 Session Closed - Attendance no longer accepted</span>';
            return;
        }
        
        const minutes = Math.floor(distance / 60000);
        const seconds = Math.floor((distance % 60000) / 1000);
        
        countdownDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (minutes < 1) {
            countdownDisplay.classList.add('countdown-warning');
        } else {
            countdownDisplay.classList.remove('countdown-warning');
        }
    }
    
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
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

    // Store location requirement
    locationRequired = data.requireLocation === 'YES';
    if (locationRequired && data.classLat && data.classLng) {
        classroomLocation = { lat: parseFloat(data.classLat), lng: parseFloat(data.classLng) };
        const locationDiv = document.getElementById('locationStatus');
        if (locationDiv) locationDiv.style.display = 'block';
    }
    
    try {
        const response = await fetch(`/api/session-status?session=${sessionId}`);
        const data = await response.json();
        
        if (!data.active) {
            sessionInfo.innerHTML = '<span>🔴 Session Closed - Attendance no longer accepted</span>';
            submitBtn.disabled = true;
            if (messageDiv) showMessage(messageDiv, 'This attendance session has closed.', 'error');
        } else if (data.expiresIn) {
            sessionInfo.innerHTML = '<span>🟢 Session Active</span>';
            startCountdown(data.expiresAt);
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

    // If location required, verify before submission
    if (locationRequired && classroomLocation) {
        const locationStatus = document.getElementById('locationMessage');
        locationStatus.innerHTML = ' Verifying your location...';
        
        try {
            const location = await getUserLocation();
            const distance = calculateDistance(
                classroomLocation.lat, classroomLocation.lng,
                location.lat, location.lng
            );
            
            if (distance > 30) {
                locationStatus.innerHTML = ` You are ${Math.round(distance)} meters away. Must be within 30 meters of classroom.`;
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Attendance';
                return;
            }
            
            locationStatus.innerHTML = `Location verified (${Math.round(distance)}m from classroom)`;
        } catch (error) {
            locationStatus.innerHTML = ` ${error.message}`;
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Attendance';
            return;
        }
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
                timestamp: new Date().toISOString(),
                userLat: userLocation?.lat,
                userLng: userLocation?.lng
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showMessage(messageDiv, ` Attendance recorded for ${name}`, 'success');
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

// Geolocation variables
let userLocation = null;
let locationRequired = false;

// Get user's current location
function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported by your browser'));
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                resolve(userLocation);
            },
            (error) => {
                let message = 'Location access denied. ';
                if (error.code === 1) message += 'Please enable location in your browser settings.';
                else if (error.code === 2) message += 'Location unavailable.';
                else message += 'Please try again.';
                reject(new Error(message));
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    });
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c; // distance in meters
}

// Initialize
setupRealTimeValidation();
checkSessionStatus();