class CustomDiscordWebhookModal extends HTMLElement {
  constructor(){ super(); this.visible=false; }
  connectedCallback(){
    this.innerHTML = `
    <div id="discordWebhookModal" class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 ${this.visible?'block':'hidden'}">
      <div class="bg-gray-800 p-6 rounded-lg w-96">
        <h2 class="text-xl font-bold mb-4">Guild Webhooks</h2>
        <label>Guild Name:</label>
        <input id="guildNameInput" class="w-full mb-2 px-2 py-1 rounded bg-gray-700"/>
        <label>Webhook URL:</label>
        <input id="webhookUrlInput" class="w-full mb-4 px-2 py-1 rounded bg-gray-700"/>
        <button id="addWebhookBtn" class="bg-green-600 px-4 py-2 rounded">Add</button>
        <div id="webhookList" class="mt-4"></div>
      </div>
    </div>`;
    
    this.querySelector('#addWebhookBtn').addEventListener('click', async ()=>{
      const guild = this.querySelector('#guildNameInput').value.trim();
      const url = this.querySelector('#webhookUrlInput').value.trim();
      if(!guild || !url) return alert('Both fields required');

      const snapshot = await db.collection('webhooks').where('guild','==',guild).where('url','==',url).get();
      if(!snapshot.empty) return alert('Webhook already exists');

      await db.collection('webhooks').add({guild,url});
      alert('Webhook added!');
      this.renderList();
    });

    this.renderList();
  }

  async renderList(){
    const listEl = this.querySelector('#webhookList');
    listEl.innerHTML = '';
    const snapshot = await db.collection('webhooks').get();
    snapshot.forEach(doc=>{
      const data = doc.data();
      const div = document.createElement('div');
      div.className='text-gray-300 text-sm';
      div.textContent=`${data.guild}`;
      listEl.appendChild(div);
    });
  }

  setAttribute(name,val){ if(name==='visible') this.visible=val==='true'; }
}
customElements.define('custom-discord-webhook-modal', CustomDiscordWebhookModal);