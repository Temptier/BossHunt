class CustomControlRoomModal extends HTMLElement {
  constructor(){ super(); this.visible=false; }
  connectedCallback(){
    this.innerHTML = `
    <div id="controlRoomModal" class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 ${this.visible?'block':'hidden'}">
      <div class="bg-gray-800 p-6 rounded-lg w-96">
        <h2 class="text-xl font-bold mb-4">Control Room</h2>
        <div id="bossSelectList" class="max-h-64 overflow-y-auto mb-2"></div>
        <label>Optional Message:</label>
        <input id="controlMessage" class="w-full mb-4 px-2 py-1 rounded bg-gray-700"/>
        <button id="sendControlBtn" class="bg-blue-600 px-4 py-2 rounded">Send to Discord</button>
      </div>
    </div>`;

    this.renderBossList();

    this.querySelector('#sendControlBtn').addEventListener('click', async ()=>{
      const message = this.querySelector('#controlMessage').value;
      const selected = Array.from(this.querySelectorAll('input[name="bossCheckbox"]:checked')).map(c=>c.value);
      if(!selected.length) return alert('Select at least one boss');

      // Send to all guild webhooks
      const snapshot = await db.collection('webhooks').get();
      snapshot.forEach(doc=>{
        const data = doc.data();
        fetch(data.url, {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({content: `@everyone ${selected.join(', ')}\n${message}`})
        });
      });
      alert('Message sent!');
      this.style.display='none';
    });
  }

  renderBossList(){
    const listEl = this.querySelector('#bossSelectList');
    listEl.innerHTML='';
    timers.forEach(timer=>{
      const div = document.createElement('div');
      div.innerHTML = `<label class="${isToday(timer)?'text-green-400':'text-blue-400'}">
        <input type="checkbox" name="bossCheckbox" value="${timer.bossName}" class="mr-2"/>
        ${timer.bossName}
      </label>`;
      listEl.appendChild(div);
    });
  }
}
customElements.define('custom-control-room-modal', CustomControlRoomModal);

function isToday(timer){
  const now = new Date();
  if(timer.type==='manual'){
    const next = new Date(timer.lastKilled);
    return next && next.toDateString()===now.toDateString();
  } 
  if(timer.type==='scheduled'){
    return timer.spawnDays.includes(now.getDay());
  }
  return false;
}