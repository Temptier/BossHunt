class WebhookModal extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.webhooks = [];
    this.render();
    this.setupEventListeners();
    this.loadWebhooks();
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
          max-width: 600px;
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
        
        .form-group {
          margin-bottom: 1rem;
        }
        
        label {
          display: block;
          margin-bottom: 0.5rem;
          color: #e2e8f0;
          font-size: 0.9rem;
        }
        
        input {
          width: 100%;
          background: #0a0a1a;
          border: 1px solid rgba(124, 58, 237, 0.3);
          color: #e2e8f0;
          padding: 12px;
          border-radius: 8px;
          font-size: 1rem;
          transition: all 0.2s;
        }
        
        input:focus {
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
        
        .webhook-list {
          margin-top: 2rem;
          border-top: 1px solid rgba(124, 58, 237, 0.2);
          padding-top: 1.5rem;
        }
        
        .webhook-item {
          background: rgba(10, 10, 26, 0.5);
          border: 1px solid rgba(124, 58, 237, 0.2);
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 0.75rem;
          display: flex;
          justify-between;
          align-items: center;
        }
        
        .webhook-info {
          flex: 1;
        }
        
        .webhook-name {
          font-weight: 600;
          color: #e2e8f0;
        }
        
        .webhook-url {
          font-size: 0.8rem;
          color: #94a3b8;
          word-break: break-all;
          margin-top: 0.25rem;
        }
        
        .remove-btn {
          background: #ef4444;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .remove-btn:hover {
          background: #dc2626;
          transform: scale(1.05);
        }
        
        .empty-state {
          text-align: center;
          padding: 2rem;
          color: #94a3b8;
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
        <h2>Manage Discord Webhooks</h2>
        
        <div class="form-group">
          <label for="webhook-name">Webhook Name</label>
          <input type="text" id="webhook-name" placeholder="e.g. Guild Notifications">
        </div>
        
        <div class="form-group">
          <label for="webhook-url">Discord Webhook URL</label>
          <input type="url" id="webhook-url" placeholder="https://discord.com/api/webhooks/...">
          <p class="hint">Get this from Discord server settings → Integrations → Webhooks</p>
        </div>
        
        <div class="button-group">
          <button class="btn-secondary" id="cancel-btn">Close</button>
          <button class="btn-primary" id="add-webhook-btn">Add Webhook</button>
        </div>
        
        <div class="webhook-list">
          <h3 class="font-semibold mb-3 text-gray-300">Active Webhooks</h3>
          <div id="webhooks-container">
            <div class="empty-state">
              <i data-feather="globe" class="w-12 h-12 mx-auto mb-2 opacity-50"></i>
              <p>No webhooks configured yet</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    this.shadowRoot.querySelector('#cancel-btn').addEventListener('click', () => this.remove());
    this.shadowRoot.querySelector('#add-webhook-btn').addEventListener('click', () => this.addWebhook());
    this.shadowRoot.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.addWebhook();
    });
  }

  async loadWebhooks() {
    if (!window.AppState.isOnline) {
      this.shadowRoot.querySelector('#webhooks-container').innerHTML = `
        <div class="empty-state">
          <i data-feather="wifi-off" class="w-12 h-12 mx-auto mb-2 opacity-50"></i>
          <p>Offline mode - cannot load webhooks</p>
        </div>
      `;
      feather.replace();
      return;
    }

    FirebaseHelper.getWebhooks((webhooks) => {
      this.webhooks = webhooks;
      this.renderWebhooks();
    });
  }

  renderWebhooks() {
    const container = this.shadowRoot.querySelector('#webhooks-container');
    
    if (this.webhooks.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-feather="globe" class="w-12 h-12 mx-auto mb-2 opacity-50"></i>
          <p>No webhooks configured yet</p>
        </div>
      `;
      feather.replace();
      return;
    }

    container.innerHTML = this.webhooks.map(webhook => `
      <div class="webhook-item">
        <div class="webhook-info">
          <div class="webhook-name">${webhook.name}</div>
          <div class="webhook-url">${webhook.url}</div>
        </div>
        <button class="remove-btn" onclick="this.closest('webhook-modal').removeWebhook('${webhook.id}')">
          <i data-feather="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    `).join('');
    
    feather.replace();
  }

  async addWebhook() {
    if (!window.AppState.isOnline) {
      this.showToast('Offline mode - cannot add webhooks', 'error');
      return;
    }

    const name = this.shadowRoot.querySelector('#webhook-name').value.trim();
    const url = this.shadowRoot.querySelector('#webhook-url').value.trim();
    
    if (!name || !url) {
      this.showToast('Please fill in all fields', 'warning');
      return;
    }
    
    if (!url.startsWith('https://discord.com/api/webhooks/')) {
      this.showToast('Invalid Discord webhook URL', 'error');
      return;
    }
    
    try {
      await FirebaseHelper.addWebhook(name, url);
      this.showToast(`Webhook "${name}" added successfully!`, 'success');
      
      // Clear form
      this.shadowRoot.querySelector('#webhook-name').value = '';
      this.shadowRoot.querySelector('#webhook-url').value = '';
      
      // Reload list
      this.loadWebhooks();
    } catch (error) {
      this.showToast(`Error: ${error.message}`, 'error');
    }
  }

  async removeWebhook(webhookId) {
    if (!confirm('Remove this webhook?')) return;
    
    try {
      await FirebaseHelper.removeWebhook(webhookId);
      this.showToast('Webhook removed', 'success');
      this.loadWebhooks();
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

customElements.define('webhook-modal', WebhookModal);