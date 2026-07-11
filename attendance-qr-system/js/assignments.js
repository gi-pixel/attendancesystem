const courseNames = {
    'CCS304': 'Telecommunication Networks',
    'CIIT302': 'Advanced Intelligent Networks',
    'CIIT306': 'Routing and Switching Technologies',
    'CIIT332': 'Software Defined Networks',
    'CIIT352': 'Windows Server Administration',
    'SCOT322': 'Sociology of Technology'
};


// ========== UTILITY: escapeHtml ==========
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ========== STUDENT ASSIGNMENTS PAGE ==========

let studentAssignments = [];

document.addEventListener('DOMContentLoaded', function() {
    loadStudentAssignments();
    document.getElementById('studentAssignFilter')?.addEventListener('change', loadStudentAssignments);
});

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
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            }) : '—';
            const typeIcon = assign.type === 'announcement' ? '📢' : '📝';
            const typeLabel = assign.type === 'announcement' ? 'Announcement' : 'Assignment';
            
            return `
                <div class="assignment-card" data-id="${assign.id}">
                    <div class="card-title">
                        <strong>${escapeHtml(assign.title)}</strong>
                        <span class="type-icon">${typeIcon} ${typeLabel}</span>
                    </div>
                    <div class="card-meta">
                        <span> ${courseNames[assign.course] || assign.course}</span>
                        <span> ${dueDisplay}</span>
                        <span>${statusHtml}</span>
                    </div>
                </div>
            `;
        }).join('');

        // Add click event to each card to show modal
        document.querySelectorAll('.assignment-card').forEach(card => {
            card.addEventListener('click', function() {
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
            </div>
        `;
    }
}

function getStudentStatus(assign) {
    if (assign.type === 'announcement') {
        return `<span style="color: var(--primary-500);">📢 Update</span>`;
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

function openAssignmentModal(assign) {
    const modal = document.getElementById('assignmentModal');
    document.getElementById('modalTitle').textContent = assign.title;
    document.getElementById('modalCourse').textContent = courseNames[assign.course] || assign.course;    document.getElementById('modalDue').textContent = assign.dueDate ? new Date(assign.dueDate).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    }) : '—';
    document.getElementById('modalStatus').innerHTML = getStudentStatus(assign);
    document.getElementById('modalDescription').textContent = assign.description || 'No description provided.';
    modal.style.display = 'flex';
}

// Close modal
document.getElementById('closeModalBtn')?.addEventListener('click', function() {
    document.getElementById('assignmentModal').style.display = 'none';
});

// Click outside modal to close
document.getElementById('assignmentModal')?.addEventListener('click', function(e) {
    if (e.target === this) this.style.display = 'none';
});

// Escape key to close modal
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        document.getElementById('assignmentModal').style.display = 'none';
    }
});