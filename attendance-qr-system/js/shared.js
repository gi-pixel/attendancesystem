function showMessage(element, text, type) {
    if (!element) return;
    element.textContent = text;
    element.className = `message ${type}`;
    setTimeout(() => {
        element.className = 'message';
    }, 5000);
}


function formatTime(date) {
    return new Date(date).toLocaleTimeString();
}

// ========== DARK MODE TOGGLE ==========
(function() {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Apply theme on page load
    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark-mode');
    } else if (savedTheme === 'light') {
        document.documentElement.classList.remove('dark-mode');
    } else if (prefersDark.matches) {
        document.documentElement.classList.add('dark-mode');
    }
    
    // Toggle theme function
    window.toggleTheme = function() {
        document.documentElement.classList.toggle('dark-mode');
        const isDark = document.documentElement.classList.contains('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        
        // Update toggle button icon if needed
        const toggleBtn = document.getElementById('themeToggle');
        if (toggleBtn) {
            const svg = toggleBtn.querySelector('svg');
            if (svg) {
                if (isDark) {
                    svg.innerHTML = '<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>';
                } else {
                    svg.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
                }
            }
        }
    };
    
    // Add click event to theme toggle button
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', window.toggleTheme);
    }
    
    // Update icon on page load
    const isDark = document.documentElement.classList.contains('dark-mode');
    const toggleBtn = document.getElementById('themeToggle');
    if (toggleBtn) {
        const svg = toggleBtn.querySelector('svg');
        if (svg) {
            if (isDark) {
                svg.innerHTML = '<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>';
            } else {
                svg.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
            }
        }
    }
})();