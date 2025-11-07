// welcomeModal.js — first-time user info (IGN)
export async function showWelcomeModal() {
  return new Promise((resolve) => {
    let modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/70 flex justify-center items-center z-50';
    modal.innerHTML = `
      <div class="bg-gray-800 p-6 rounded w-80 text-white">
        <h2 class="text-xl font-bold mb-4">Welcome!</h2>
        <input id="welcomeIGN" type="text" placeholder="Enter your IGN" class="w-full p-2 mb-4 text-black rounded">
        <button id="welcomeSaveBtn" class="bg-blue-600 px-3 py-1 rounded w-full">Save</button>
      </div>
    `;
    document.body.appendChild(modal);

    $('#welcomeSaveBtn')?.addEventListener('click', () => {
      const ign = $('#welcomeIGN')?.value.trim();
      if (!ign) return alert('Please enter your IGN');
      localStorage.setItem('boss_timer_user_v1', JSON.stringify({ ign }));
      modal.remove();
      resolve({ ign });
    });

    function $(s) { return modal.querySelector(s); }
  });
}

if (!localStorage.getItem('boss_timer_user_v1')) {
  showWelcomeModal();
}