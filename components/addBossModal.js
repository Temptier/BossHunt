// components/addBossModal.js
export function showAddBossModal(type='manual', onSave) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50';
  const isManual = type === 'manual';
  modal.innerHTML = `
    <div class='bg-gray-800 p-6 rounded-lg text-white max-w-sm w-full'>
      <h2 class='text-xl mb-2'>Add ${isManual ? 'Manual' : 'Scheduled'} Boss</h2>
      <input id='bossName' placeholder='Boss Name' class='w-full mb-3 p-2 rounded text-black'/>
      ${isManual ? `
        <label class='block text-sm mb-1'>Respawn Time (hours)</label>
        <input id='respawnTime' type='number' min='1' class='w-full mb-3 p-2 rounded text-black'/>
        <label class='block text-sm mb-1'>Auto Restart (mins, optional)</label>
        <input id='autoRestart' type='number' min='1' class='w-full mb-4 p-2 rounded text-black'/>
      ` : `
        <label class='block text-sm mb-1'>Day</label>
        <select id='respawnDay' class='w-full mb-3 p-2 rounded text-black'>
          <option>Monday</option><option>Tuesday</option><option>Wednesday</option>
          <option>Thursday</option><option>Friday</option><option>Saturday</option><option>Sunday</option>
        </select>
        <label class='block text-sm mb-1'>Time</label>
        <input id='respawnTime' type='time' class='w-full mb-4 p-2 rounded text-black'/>
      `}
      <div class='flex justify-end space-x-2'>
        <button id='cancelAddBoss' class='bg-gray-600 px-3 py-1 rounded'>Cancel</button>
        <button id='saveBoss' class='bg-blue-600 px-3 py-1 rounded'>Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('cancelAddBoss').onclick = () => modal.remove();
  document.getElementById('saveBoss').onclick = () => {
    const name = document.getElementById('bossName').value.trim();
    const time = document.getElementById('respawnTime')?.value;
    const auto = document.getElementById('autoRestart')?.value || null;
    const day = document.getElementById('respawnDay')?.value || null;
    if (!name || !time) return alert('Complete the fields');
    const data = isManual ? { type:'manual', name, hours: Number(time), autoRestart: auto ? Number(auto) : null } : { type:'scheduled', name, day, time };
    if (onSave) onSave(data);
    modal.remove();
  };
}