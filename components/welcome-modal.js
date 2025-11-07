class CustomWelcomeModal extends HTMLElement {
  constructor() { super(); this.visible = false; }
  connectedCallback() {
    this.innerHTML = `
    <div id="welcomeModal" class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 ${this.visible?'block':'hidden'}">
      <div class="bg-gray-800 p-6 rounded-lg w-96">
        <h2 class="text-xl font-bold mb-4">Welcome!</h2>
        <label>IGN:</label>
        <input id="ignInput" class="w-full mb-2 px-2 py-1 rounded bg-gray-700"/>
        <label>Guild:</label>
        <input id="guildInput" class="w-full mb-4 px-2 py-1 rounded bg-gray-700"/>
        <button id="saveUserBtn" class="bg-green-600 px-4 py-2 rounded">Save</button>
      </div>
    </div>`;
    this.querySelector('#saveUserBtn').addEventListener('click',()=>{
      const ign = this.querySelector('#ignInput').value.trim();
      const guild = this.querySelector('#guildInput').value.trim();
      if(!ign||!guild)return alert('All fields required');
      localStorage.setItem('userData', JSON.stringify({ign,guild,userId:Date.now()}));
      this.style.display='none';
      location.reload();
    });
  }
  setAttribute(name,val){ if(name==='visible') this.visible=val==='true'; }
}
customElements.define('custom-welcome-modal', CustomWelcomeModal);