// components/welcomeModal.js
export function showWelcomeModal() {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class='bg-gray-800 p-6 rounded-lg text-white max-w-sm w-full'>
      <h2 class='text-xl mb-2'>Welcome</h2>
      <p class='mb-4 text-sm'>Enter your In-Game Name (IGN) and Guild.</p>
      <input id='ignInput' placeholder='IGN' class='w-full mb-2 p-2 rounded text-black'/>
      <input id='guildInput' placeholder='Guild' class='w-full mb-4 p-2 rounded text-black'/>
      <div class='flex justify-end gap-2'>
        <button id='cancelWelcome' class='bg-gray-600 px-3 py-1 rounded'>Cancel</button>
        <button id='saveWelcome' class='bg-blue-600 px-3 py-1 rounded'>Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('cancelWelcome').onclick = () => modal.remove();
  document.getElementById('saveWelcome').onclick = () => {
    const ign = document.getElementById('ignInput').value.trim();
    const guild = document.getElementById('guildInput').value.trim();
    if (!ign || !guild) return alert('Please fill both fields');
    localStorage.setItem('boss_timer_user_v1', JSON.stringify({ ign, guild }));
    modal.remove();
    location.reload();
  };
}
if (!localStorage.getItem('boss_timer_user_v1')) showWelcomeModal();