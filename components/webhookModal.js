// components/webhookModal.js
import { saveWebhook } from '../firebase.js';

export function showWebhookModal(guild) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class='bg-gray-800 p-6 rounded-lg text-white max-w-sm w-full'>
      <h2 class='text-xl mb-3'>Add Discord Webhook</h2>
      <input id='webhookUrl' placeholder='Webhook URL' class='w-full mb-4 p-2 rounded text-black'/>
      <div class='flex justify-end space-x-2'>
        <button id='cancelWebhook' class='bg-gray-600 px-3 py-1 rounded'>Cancel</button>
        <button id='saveWebhook' class='bg-blue-600 px-3 py-1 rounded'>Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('cancelWebhook').onclick = () => modal.remove();
  document.getElementById('saveWebhook').onclick = async () => {
    const url = document.getElementById('webhookUrl').value.trim();
    if (!url.startsWith('https://discord.com/api/webhooks/')) return alert('Invalid Discord webhook URL');
    try {
      await saveWebhook(guild, url);
      alert('Webhook saved');
      modal.remove();
    } catch (err) {
      alert(err.message || 'Failed to save webhook');
    }
  };
}