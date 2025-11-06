class CustomDiscordWebhookModal extends HTMLElement {
  connectedCallback(){ this.render(); }
  render(){
    const userWebhook = localStorage.getItem('webhookUrl') || '';
    this.innerHTML = `
      <div id="dw" class="hidden fixed inset-0 flex items-center justify-center modal-overlay">
        <div class="bg-gray-800 p-6 rounded-lg w-full max-w-md">
          <h3 class="text-xl font-semibold mb-3">Discord Webhook</h3>
          <label class="block text-sm mb-1">Your webhook URL</label>
          <input id="dw-user" class="w-full bg-gray-700 px-3 py-2 rounded mb-3" value="${userWebhook}">
          <div class="flex justify-end gap-2">
            <button id="dw-close" class="px-3 py-2 bg-gray-600 rounded">Close</button>
            <button id="dw-save" class="px-3 py-2 bg-green-600 rounded">Save</button>
          </div>
        </div>
      </div>`;
    feather.replace();
    this.querySelector('#dw-close')?.addEventListener('click', ()=> this.querySelector('#dw').classList.add('hidden'));
    this.querySelector('#dw-save')?.addEventListener('click', ()=>{
      const url = this.querySelector('#dw-user').value.trim();
      if (!url.startsWith('https://discord.com/api/webhooks/')) return alert('Invalid webhook URL');
      localStorage.setItem('webhookUrl', url);
      alert('Webhook saved');
      this.querySelector('#dw').classList.add('hidden');
      location.reload();
    });
    this.open = () => this.querySelector('#dw').classList.remove('hidden');
  }
}
customElements.define('custom-discord-webhook-modal', CustomDiscordWebhookModal);