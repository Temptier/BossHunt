class CustomStopAllModal extends HTMLElement {
  constructor(){ super(); this.visible=false; }
  connectedCallback(){
    this.innerHTML = `
    <div id="stopAllModal" class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 ${this.visible?'block':'hidden'}">
      <div class="bg-gray-800 p-6 rounded-lg w-80">
        <h2 class="text-xl font-bold mb-4">Stop All Timers</h2>
        <label>Password:</label>
        <input type="password" id="stopPasswordInput" class="w-full mb-4 px-2 py-1 rounded bg-gray-700"/>
        <button id="confirmStopBtn" class="bg-red-600 px-4 py-2 rounded">Stop All</button>
      </div>
    </div>`;
    
    this.querySelector('#confirmStopBtn').addEventListener('click', async ()=>{
      const password = this.querySelector('#stopPasswordInput').value;
      if(password!=='theworldo') return alert('Incorrect password');

      const batch = db.batch();
      timers.forEach(timer=>{
        const ref = db.collection('timers').doc(timer.id);
        if(timer.type==='manual') batch.update(ref,{lastKilled:null,missCount:0});
        if(timer.type==='scheduled') batch.update(ref,{lastSpawned:null});
      });
      await batch.commit();
      alert('All timers stopped!');
      this.style.display='none';
    });
  }
  setAttribute(name,val){ if(name==='visible') this.visible=val==='true'; }
}
customElements.define('custom-stop-all-modal', CustomStopAllModal);