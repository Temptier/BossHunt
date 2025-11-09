/* components/controlRoomModal.js
   Lightweight control panel stub for quick admin actions from the main page.
*/

(() => {
  function openControls() {
    if (!confirm('Open Control Room? (Requires admin auth on admin page)')) return;
    window.location.href = '/admin.html';
  }

  document.addEventListener('DOMContentLoaded', () => {
    // You can add UI hooks here if you include a control room button in index.html
    const controlBtn = document.getElementById('control-room-btn');
    if (controlBtn) controlBtn.addEventListener('click', openControls);
  });
})();