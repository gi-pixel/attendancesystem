// Shared functions for both student and professor pages

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