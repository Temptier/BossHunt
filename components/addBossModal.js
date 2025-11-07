class AddBossModal extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.timerType = 'manual';
    this.render();
    this.setupEventListeners();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.3s ease;
        }
        
        .modal {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border: 1px solid rgba(124, 58, 237, 0.3);
          border-radius: 16px;
          padding: 2rem;
          max-width: 500px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
          animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        h2 {
          font-family: 'Orbitron', monospace;
          font-size: 1.5rem;
          margin-bottom: 1.5rem;
          background: linear-gradient(135deg, #7c3aed, #ec4899);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        .tab-nav {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
        }
        
        .tab-btn {
          flex: 1;
          padding: 10px;
          background: #0a0a1a;
          border: 1px solid rgba(124, 58, 237, 0.2);
          color: #94a3b8;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .tab-btn.active {
          background: linear-gradient(135deg, #7c3aed, #8b5cf6);
          color: white;
          border-color: #7c3aed;
        }
        
        .tab-content {
          display: none;
        }
        
        .tab-content.active {
          display: block;
        }
        
        .form-group {
          margin-bottom: 1rem;
        }
        
        label {
          display: block;
          margin-bottom: 0.5rem;
          color: #e2e8f0;
          font-size: 0.9rem;
        }
        
        input, select {
          width: 100%;
          background: #0a0a1a;
          border: 1px solid rgba(124, 58, 237, 0.3);
          color: #e2e8f0;
          padding: 12px;
          border-radius: 8px;
          font-size: 1rem;
          transition: all 0.2s;
        }
        
        input:focus, select:focus {
          outline: none;
          border-color: #7c3aed;
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.2);
        }
        
        .button-group {
          display: flex;
          gap: 1rem;
          margin-top: 1.5rem;
        }
        
        button {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .btn-primary {
          background: linear-gradient(135deg, #7c3aed, #8b5cf6);
          color: white;
        }
        
        .btn-secondary {
          background: #374151;
          color: white;
        }
        
        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        }
        
        .hint {
          font-size: 0.8rem;
          color: #94a3b8;
          margin-top: 0.25rem;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      </style>
      
      <div class="modal">
        <h2>Add New Boss Timer</h2>
        
        <div class="tab-nav">
          <button class="tab-btn ${this.timerType === 'manual' ? 'active' : ''}" data-type="manual">Manual</button>
          <button class="tab-btn ${this.timerType === 'scheduled' ? 'active' : ''}" data-type="scheduled">Scheduled</button>
        </div>
        
        <!-- Manual Timer Form -->
        <div class="tab-content ${this.timerType === 'manual' ? 'active' : ''}" id="manual-form">
          <div class="form-group">
            <label for="boss-name-manual">Boss Name</label>
            <input type="text" id="boss-name-manual" placeholder="e.g. Ancient Dragon" autofocus>
          </div>
          
          <div class="form-group">
            <label for="respawn-hours">Respawn Time (hours)</label>
            <input type="number" id="respawn-hours" placeholder="24" step="0.5" min="0.1">
            <p class="hint">Time until this boss respawns after being killed</p>
          </div>
          
          <div class="form-group">
            <label for="auto-restart">Auto Restart (minutes) - Optional</label>
            <input type="number" id="auto-restart" placeholder="10" step="1" min="0">
            <p class="hint">Automatically restart timer after spawn (set 0 or empty to disable)</p>
          </div>
        </div>
        
        <!-- Scheduled Timer Form -->
        <div class="tab-content ${this.timerType === 'scheduled' ? 'active' : ''}" id="scheduled-form">
          <div class="form-group">
            <label for="boss-name-scheduled">Boss Name</label>
            <input type="text" id="boss-name-scheduled" placeholder="e.g. World Boss Alpha" ${this.timerType === 'scheduled' ? 'autofocus' : ''}>
          </div>
          
          <div class="form-group">
            <label for="day-of-week">Spawn Day</label>
            <select id="day-of-week">
              <option value="0">Sunday</option>
              <option value="1">Monday</option>
              <option value="2">Tuesday</option>
              <option value="3">Wednesday</option>
              <option value="4">Thursday</option>
              <option value="5">Friday</option>
              <option value="6">Saturday</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="spawn-time">Spawn Time</label>
            <input type="time" id="spawn-time">
            <p class="hint">When this boss spawns (server time)</p>
          </div>
        </div>
        
        <div class="button-group">
          <button class="btn-secondary" id="cancel-btn">Cancel</button>
          <button class="btn-primary" id="save-btn">Add Timer</button>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    // Tab switching
    this.shadowRoot.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.timerType = e.target.dataset.type;
        this.updateTabs();
      });
    });

    // Buttons
    this.shadowRoot.querySelector('#cancel-btn').addEventListener('click', () => this.remove());
    this.shadowRoot.querySelector('#save-btn').addEventListener('click', () => this.saveTimer());
    
    // Enter key
    this.shadowRoot.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.saveTimer();
    });
  }

  updateTabs() {
    const tabs = this.shadowRoot.querySelectorAll('.tab-btn');
    const contents = this.shadowRoot.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.type === this.timerType);
    });
    
    contents.forEach(content => {
      content.classList.toggle('active', content.id === `${this.timerType}-form`);
    });
  }

  async saveTimer() {
    if (!window.AppState.isOnline) {
      this.showToast('Offline mode - cannot add timers', 'error');
      return;
    }

    try {
      if (this.timerType === 'manual') {
        const bossName = this.shadowRoot.querySelector('#boss-name-manual').value.trim();
        const respawnHours = this.shadowRoot.querySelector('#respawn-hours').value;
        const autoRestart = this.shadowRoot.querySelector('#auto-restart').value;
        
        if (!bossName || !respawnHours || parseFloat(respawnHours) <= 0) {
          this.showToast('Please fill in all required fields', 'warning');
          return;
        }
        
        await FirebaseHelper.addManualTimer(bossName, respawnHours, autoRestart || null);
        this.showToast(`Manual timer for ${bossName} added!`, 'success');
      } else {
        const bossName = this.shadowRoot.querySelector('#boss-name-scheduled').value.trim();
        const dayOfWeek = parseInt(this.shadowRoot.querySelector('#day-of-week').value);
        const time = this.shadowRoot.querySelector('#spawn-time').value;
        
        if (!bossName || !time) {
          this.showToast('Please fill in all required fields', 'warning');
          return;
        }
        
        await FirebaseHelper.addScheduledTimer(bossName, dayOfWeek, time);
        this.showToast(`Scheduled timer for ${bossName} added!`, 'success');
      }
      
      this.remove();
    } catch (error) {
      this.showToast(`Error: ${error.message}`, 'error');
    }
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-purple-600'} text-white px-6 py-3 rounded-lg shadow-lg`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

customElements.define('add-boss-modal', AddBossModal);