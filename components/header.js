class CustomHeader extends HTMLElement {
    connectedCallback() {
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <style>
                header {
                    background: linear-gradient(145deg, #1e293b, #0f172a);
                    padding: 1rem 2rem;
                    border-radius: 0.5rem;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                }
                
                .logo {
                    background: linear-gradient(90deg, #3b82f6, #8b5cf6);
                    -webkit-background-clip: text;
                    background-clip: text;
                    color: transparent;
                    font-weight: 800;
                }
                
                .btn {
                    transition: all 0.2s ease;
                    display: inline-flex;
                    align-items: center;
                }
                
                .btn:hover {
                    transform: translateY(-1px);
                }
                
                .btn-primary {
                    background-color: #3b82f6;
                }
                
                .btn-primary:hover {
                    background-color: #2563eb;
                }
                
                .btn-secondary {
                    background-color: #1e293b;
                }
                
                .btn-secondary:hover {
                    background-color: #334155;
                }
                
                .btn-danger {
                    background-color: #ef4444;
                }
                
                .btn-danger:hover {
                    background-color: #dc2626;
                }
                
                .btn-success {
                    background-color: #10b981;
                }
                
                .btn-success:hover {
                    background-color: #059669;
                }
                
                @media (max-width: 768px) {
                    .header-content {
                        flex-direction: column;
                        gap: 1rem;
                    }
                    
                    .header-actions {
                        flex-direction: row;
                        flex-wrap: wrap;
                        justify-content: center;
                    }
                }
            </style>
            
            <header>
                <div class="header-content flex flex-col md:flex-row justify-between items-center gap-4">
                    <div class="flex items-center space-x-4">
                        <h1 class="logo text-2xl md:text-3xl">BossTrack Pro</h1>
                        <span class="text-sm bg-gray-700 text-blue-400 px-2 py-1 rounded-full">
                            <i data-feather="users" class="w-3 h-3 inline mr-1"></i>
                            <span id="currentGuild">Vesperial</span>
                        </span>
                    </div>
                    
                    <div class="header-actions flex flex-wrap gap-2">
                        <button class="btn btn-primary py-2 px-4 rounded-full text-sm">
                            <i data-feather="refresh-cw" class="w-4 h-4 mr-1"></i> Restart All
                        </button>
                        <button class="btn btn-secondary py-2 px-4 rounded-full text-sm">
                            <i data-feather="pause" class="w-4 h-4 mr-1"></i> Stop All
                        </button>
                        <button class="btn btn-success py-2 px-4 rounded-full text-sm">
                            <i data-feather="send" class="w-4 h-4 mr-1"></i> Send Timers
                        </button>
                        <div class="flex items-center bg-gray-700 rounded-full px-3">
                            <span class="text-xs mr-2">Webhook:</span>
                            <button id="webhookToggle" class="text-xs font-mono bg-blue-600 text-white px-2 py-1 rounded-full">
                                #1
                            </button>
                        </div>
                        <button class="btn btn-secondary py-2 px-4 rounded-full text-sm" id="themeToggle">
                            <i data-feather="moon" class="w-4 h-4 mr-1"></i> Theme
                        </button>
                        <button class="btn btn-danger py-2 px-4 rounded-full text-sm" id="changeUserBtn">
                            <i data-feather="user" class="w-4 h-4 mr-1"></i> Change User
                        </button>
                    </div>
                </div>
            </header>
        `;
        
        // Add event listeners after rendering
        setTimeout(() => {
            const webhookToggle = this.shadowRoot.getElementById('webhookToggle');
            const themeToggle = this.shadowRoot.getElementById('themeToggle');
            const changeUserBtn = this.shadowRoot.getElementById('changeUserBtn');
            const currentGuild = this.shadowRoot.getElementById('currentGuild');
            
            // Set current guild
            currentGuild.textContent = window.currentUser?.guild || 'Guest';
            
            // Webhook toggle
            webhookToggle.addEventListener('click', () => {
                window.activeDiscordWebhook = window.activeDiscordWebhook === 1 ? 2 : 1;
                webhookToggle.textContent = `#${window.activeDiscordWebhook}`;
                localStorage.setItem('activeWebhook', window.activeDiscordWebhook.toString());
            });
            
            // Theme toggle
            themeToggle.addEventListener('click', () => {
                const html = document.documentElement;
                if (html.classList.contains('dark')) {
                    html.classList.remove('dark');
                    html.classList.add('light');
                    localStorage.setItem('theme', 'light');
                    themeToggle.innerHTML = '<i data-feather="sun" class="w-4 h-4 mr-1"></i> Theme';
                } else {
                    html.classList.remove('light');
                    html.classList.add('dark');
                    localStorage.setItem('theme', 'dark');
                    themeToggle.innerHTML = '<i data-feather="moon" class="w-4 h-4 mr-1"></i> Theme';
                }
                feather.replace();
            });
            
            // Change user
            changeUserBtn.addEventListener('click', () => {
                localStorage.removeItem('bossTrackUser');
                window.location.reload();
            });
            
            // Replace feather icons
            feather.replace();
        }, 0);
    }
}

customElements.define('custom-header', CustomHeader);