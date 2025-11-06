class CustomStopAllModal extends HTMLElement {
  connectedCallback(){ this.render(); }
  render(){
    this.innerHTML = `
      <div id="stopAll" class="hidden fixed inset-0 flex items-center justify-center modal-overlay">
        <div class="bg-gray-800 p-6 rounded-lg w-full max-w-md">
          <h3 class="text-xl font-semibold mb-2">Stop All Timers (Admin)</h3>
          <p class="text-sm text-gray-400 mb-4">Enter admin password to stop all manual timers.</p>
          <input id="stopPw" type="password" class="w-full bg-gray-700 px-3 py-2 rounded mb-4" placeholder="Password">
          <div class="flex justify-end gap-2">
            <button id="stopClose" class="px-3 py-2 bg-gray-600 rounded">Cancel</button>
            <button id="stopConfirm" class="px-3 py-2 bg-red-600 rounded">Stop All</button>
          </div>
        </div>
      </div>`;
    feather.replace();
    this.querySelector('#stopClose')?.addEventListener('click', ()=> this.querySelector('#stopAll').classList.add('hidden'));
    this.querySelector('#stopConfirm')?.addEventListener('click', async ()=>{
      const pw = this.querySelector('#stopPw').value;
      if (pw !== 'theworldo') { alert('Wrong password'); return; }
      await db.collection('system').doc('control').set({ stopAll: true, lastStopped: Date.now() });
      alert('Stop All triggered');
      window.logAdminAction?.('Stop All Triggered', 'Admin used stop all');
      this.querySelector('#stopAll').classList.add('hidden');
    });
  }
}
customElements.define('custom-stop-all-modal', CustomStopAllModal);