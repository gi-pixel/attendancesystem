// ========== STUDENT ASSIGNMENTS PAGE ==========

let courseNames = {};                 // { CCS304: "Telecommunication Networks", ... }
let coursesReady = false;
let studentAssignments = [];

// ========== UTILITY: escapeHtml ==========
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ========== FETCH COURSES (populate dropdown + names map) ==========
async function loadCourses() {
    try {
        const res = await fetch('/api/courses');
        const data = await res.json();
        if (data.success && Array.isArray(data.courses)) {
            courseNames = {};
            data.courses.forEach(c => { courseNames[c.code] = c.name; });
            populateFilter(data.courses);
            coursesReady = true;
        }
    } catch (err) {
        console.error('Failed to load courses:', err);
        // Dropdown stays with just "All Courses" — assignments still load
    }
}

function populateFilter(courses) {
    const sel = document.getElementById('studentAssignFilter');
    if (!sel) return;
    sel.innerHTML = '<option value="">All Courses</option>' +
        courses.map(c => `<option value="${escapeHtml(c.code)}">${escapeHtml(c.name)}</option>`).join('');
}

// ========== LOAD ASSIGNMENTS ==========
async function loadStudentAssignments() {
    const course = document.getElementById('studentAssignFilter').value;
    const container = document.getElementById('studentAssignmentsContainer');

    container.innerHTML = '<div style="text-align: center; padding: 2rem;"><div class="loading-spinner" style="margin: 0 auto; display: block;"></div><p style="color: var(--text-muted); margin-top: 0.5rem;">Loading...</p></div>';

    try {
        let url = '/api/assignments';
        const params = new URLSearchParams();
        if (course) params.append('course', course);
        if (params.toString()) url += '?' + params.toString();

        const response = await fetch(url);
        const data = await response.json();

        if (!data.success) throw new Error(data.error || 'Failed to load');

        studentAssignments = data.assignments || [];

        if (studentAssignments.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>📭 No assignments or updates available.</p>
                    <p style="font-size: 0.8rem; margin-top: 0.25rem;">Check back later for new posts from your lecturers.</p>
                </div>
            `;
            return;
        }

        // Render as cards
        container.innerHTML = studentAssignments.map(assign => {
            const statusHtml = getStudentStatus(assign);
            const dueDisplay = assign.dueDate ? new Date(assign.dueDate).toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric'
            }) : '—';
            const typeIcon = assign.type === 'announcement' ? '📢' : '📝';
            const typeLabel = assign.type === 'announcement' ? 'Announcement' : 'Assignment';

            return `
                <div class="assignment-card" data-id="${escapeHtml(assign.id)}">
                    <div class="card-title">
                        <strong>${escapeHtml(assign.title)}</strong>
                        <span class="type-icon">${typeIcon} ${typeLabel}</span>
                    </div>
                    <div class="card-meta">
                        <span>📚 ${escapeHtml(courseNames[assign.course] || assign.course)}</span>
                        <span>📅 ${dueDisplay}</span>
                        <span>${statusHtml}</span>
                    </div>
                </div>
            `;
        }).join('');

        // Click card → open modal
        document.querySelectorAll('.assignment-card').forEach(card => {
            card.addEventListener('click', function () {
                const id = this.dataset.id;
                const assign = studentAssignments.find(a => a.id === id);
                if (assign) openAssignmentModal(assign);
            });
        });

    } catch (error) {
        console.error('Error loading student assignments:', error);
        container.innerHTML = `
            <div class="empty-state" style="color: var(--danger);">
                <p>❌ Error loading assignments</p>
                <p style="font-size: 0.8rem; margin-top: 0.25rem;">${escapeHtml(error.message)}</p>
                <p style="font-size: 0.7rem; margin-top: 0.5rem; color: var(--text-muted);">Check console for details</p>
            </div>
        `;
    }
}

// ========== STATUS BADGE ==========
function getStudentStatus(assign) {
    if (assign.type === 'announcement') {
        return `<span style="color: var(--primary-500);">📢 Update</span>`;
    }
    if (assign.type !== 'assignment') {
        // midsem, test, presentation, etc.
        const label = assign.type.charAt(0).toUpperCase() + assign.type.slice(1);
        return `<span style="color: var(--warning);">📌 ${label}</span>`;
    }
    const now = new Date();
    const due = assign.dueDate ? new Date(assign.dueDate) : null;
    if (!due) return `<span style="color: var(--text-muted);">No due date</span>`;
    const diff = due - now;
    if (diff < 0) {
        return `<span style="color: var(--danger);">🔴 Overdue</span>`;
    } else if (diff < 86400000 * 2) {
        const days = Math.ceil(diff / 86400000);
        return `<span style="color: var(--warning);">🟡 ${days} day${days > 1 ? 's' : ''} left</span>`;
    } else {
        const days = Math.ceil(diff / 86400000);
        return `<span style="color: var(--success);">🟢 ${days} days left</span>`;
    }
}

// ========== MODAL ==========
function openAssignmentModal(assign) {
    const modal = document.getElementById('assignmentModal');
    document.getElementById('modalTitle').textContent = assign.title;
    document.getElementById('modalCourse').textContent = courseNames[assign.course] || assign.course;  // FULL NAME
    document.getElementById('modalDue').textContent = assign.dueDate ? new Date(assign.dueDate).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    }) : '—';
    document.getElementById('modalStatus').innerHTML = getStudentStatus(assign);
    document.getElementById('modalDescription').textContent = assign.description || 'No description provided.';
    modal.style.display = 'flex';
}

document.getElementById('closeModalBtn')?.addEventListener('click', () => {
    document.getElementById('assignmentModal').style.display = 'none';
});

document.getElementById('assignmentModal')?.addEventListener('click', function (e) {
    if (e.target === this) this.style.display = 'none';
});

document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        document.getElementById('assignmentModal').style.display = 'none';
    }
});

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', async function () {
    // Load courses first so names show correctly, then assignments
    await loadCourses();
    await loadStudentAssignments();

    document.getElementById('studentAssignFilter')?.addEventListener('change', loadStudentAssignments);
});