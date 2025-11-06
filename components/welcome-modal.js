class CustomWelcomeModal extends HTMLElement {
  connectedCallback() { this.render(); }
  render() {
    const user = JSON.parse(localStorage.getItem('userData') || 'null');
    const show = user ? 'hidden' : '';
    this.innerHTML = `
      <div id="welcomeModal" class="modal-overlay fixed inset-0 flex items-center justify-center ${show}">
        <div class="bg-gray-800 p-6 rounded-lg w-full max-w-md">
          <h3 class="text-xl font-semibold mb-3">Welcome — quick setup</h3>
          <p class="text-sm text-gray-400 mb-4">Enter your IGN and Guild (stored locally).</p>
          <label class="block text-sm mb-1">IGN</label>
          <input id="wm-ign" class="w-full bg-gray-700 px-3 py-2 rounded mb-3" value="${user?user.ign:''}">
          <label class="block text-sm mb-1">Guild</label>
          <input id="wm-guild" class="w-full bg-gray-700 px-3 py-2 rounded mb-4" value="${user?user.guild:''}">
          <div class="flex justify-end">
            <button id="wm-save" class="px-3 py-2 rounded bg-blue-600">Save</button>
          </div>
        </div>
      </div>`;
    feather.replace();
    this.querySelector('#wm-save')?.addEventListener('click', () => {
      const ign = this.querySelector('#wm-ign').value.trim();
      const guild = this.querySelector('#wm-guild').value.trim();
      if(!ign || !guild) return alert('Both fields required');
      const data = { ign, guild, userId: `${ign.toLowerCase().replace(/\s+/g,'-')}-${Date.now()}`};
      localStorage.setItem('userData', JSON.stringify(data));
      window.userData = data;
      document.getElementById('welcomeModal').classList.add('hidden');
      location.reload();
    });
  }
  open() { this.querySelector('#welcomeModal')?.classList.remove('hidden'); }
}
customElements.define('custom-welcome-modal', CustomWelcomeModal);