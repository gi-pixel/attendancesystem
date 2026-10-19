// ========== DARK MODE TOGGLE (attribute-based) ==========
(function () {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

    // Apply initial theme
    function applyTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.documentElement.classList.add('dark-mode'); // legacy fallback
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            document.documentElement.classList.remove('dark-mode');
        }
        updateToggleIcon(theme);
    }

    // Set icon in the toggle button
    function updateToggleIcon(theme) {
        const btn = document.getElementById('themeToggle');
        if (!btn) return;
        const svg = btn.querySelector('svg');
        if (!svg) return;
        if (theme === 'dark') {
            // Sun icon (to switch to light)
            svg.innerHTML = '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>';
        } else {
            // Moon icon (to switch to dark)
            svg.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
        }
    }

    // Resolve initial theme
    let initialTheme = savedTheme || (prefersDark.matches ? 'dark' : 'light');
    applyTheme(initialTheme);

    // Toggle handler
    window.toggleTheme = function () {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', next);
        applyTheme(next);
    };

    // Attach click listener once DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('themeToggle');
        if (btn) btn.addEventListener('click', window.toggleTheme);
        // Re-apply to sync icon state on load
        applyTheme(document.documentElement.getAttribute('data-theme') || 'light');
    });
})();