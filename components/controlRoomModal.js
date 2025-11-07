class ControlRoomModal extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.timerId = this.dataset.timerId;
    this.timer = null;
    this.render();
    this.loadTimer();
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
          max-width: 400px;
          width: 90%;
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
        
        .timer-details {
          background: rgba(10, 10, 26, 0.5);
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1.5rem;
        }
        
        .detail-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
          font-size: 0.9rem;
        }
        
        .detail-label {
          color: #94a3b8;
        }
        
        .detail-value {
          color: #e2e8f0;
          font-weight: 500;
        }
        
        .button-group {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        
        button {
          width: 100%;
          padding: 12px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }
        
        .btn-primary {
          background: linear-gradient(135deg, #7c3aed, #8b5cf6);
          color: white;
        }
        
        .btn-secondary {
          background: #374151;
          color: white;
        }
        
        .btn-danger {
          background: #ef4444;
          color: white;
        }
        
        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        }
        
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }
        
        .loading {
          text-align: center;
          padding: 2rem;
          color: #94a3b8;
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
        <h2>Timer Control Room</h2>
        
        <div id="content">
          <div class="loading">
            <i data-feather="loader" class="w-8 h-8 animate-spin mx-auto mb-2"></i>
            Loading timer details...
          </div>
        </div>
      </div>
    `;
  }

  async loadTimer() {
    if (!window.AppState.isOnline) {
      this.shadowRoot.querySelector('#content').innerHTML = `
        <div class="text-center text-red-400">
          <i data-feather="wifi-off" class="w-12 h-12 mx-auto mb-2"></i>
          <p>Offline mode - cannot load timer details</p>
        </div>
      `;
      feather.replace();
      return;
    }

    const doc = await FirebaseHelper.timersRef.doc(this.timerId).get();
    if (doc.exists) {
      this.timer = { id: doc.id, ...doc.data() };
      this.renderDetails();
    } else {
      this.shadowRoot.querySelector('#content').innerHTML = `
        <div class="text-center text-red-400">
          <i data-feather="alert-circle" class="w-12 h-12 mx-auto mb-2"></i>
          <p>Timer not found</p>
        </div>
      `;
      feather.replace();
    }
  }

  renderDetails() {
    const content = this.shadowRoot.querySelector('#content');
    const timer =