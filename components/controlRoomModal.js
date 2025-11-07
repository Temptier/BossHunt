// components/controlRoomModal.js
export function showControlRoomModal(bosses = [], onSend) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 overflow-auto';
  const bossList = bosses.map(b => `
    <label class='flex items-center space-x-2 p-2 bg-gray-700 rounded mb-2'>
      <input type='checkbox' value='${b.name}' />
      <span class='${b.isToday ? 'text-green-400' : 'text-blue-400'}'>${b.name}</span>
    </label>
  `).join('');
  modal.innerHTML = `
    <div class='bg-gray-800 p-6 rounded-lg text-white max-w-md w-full'>
      <h2 class='text-xl mb-3'>Control Room</h2>
      <div id='bossList' class='max-h-64 overflow-y-auto mb-3'>${bossList}</div>
      <textarea id='message' placeholder='Optional message...' class='w-full p-2 mb-4 rounded text-black'></textarea>
      <div class='flex justify-between items-center'>
        <label class='text-sm'>10-min auto warning enabled</label>
        <div class='space-x-2'>
          <button id='cancelControl' class='bg-gray-600 px-3 py-1 rounded'>Cancel</button>
          <button id='sendControl' class='bg-blue-600 px-3 py-1 rounded'>Send</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('cancelControl').onclick = () => modal.remove();
  document.getElementById('sendControl').onclick = () => {
    const selected = Array.from(modal.querySelectorAll('input[type="checkbox"]:checked')).map(x => x.value);
    const msg = document.getElementById('message').value;
    if (!selected.length) return alert('Select at least one boss');
    if (onSend) onSend(selected, msg);
    modal.remove();
  };
}