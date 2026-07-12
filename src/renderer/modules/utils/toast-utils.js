/**
 * Show a brief auto-dismissing toast near the top of the window.
 * @param {string} message
 * @param {number} [duration=3000] Milliseconds before auto-dismissal
 */
export function showDropToast(message, duration = 3000) {
  document.getElementById('file-drop-toast')?.remove();

  const toast = document.createElement('div');
  toast.id = 'file-drop-toast';
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed',
    top: '1rem',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: '10001',
    padding: '0.5rem 1.25rem',
    borderRadius: '0.375rem',
    background: 'rgba(0, 0, 0, 0.85)',
    color: 'white',
    fontSize: '0.9rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    opacity: '0',
    transition: 'opacity 0.2s ease'
  });
  document.body.appendChild(toast);

  requestAnimationFrame(() => { toast.style.opacity = '1'; });
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, duration);
}
