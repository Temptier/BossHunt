class CustomFooter extends HTMLElement {
    connectedCallback() {
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <style>
                footer {
                    background: linear-gradient(145deg, #1e293b, #0f172a);
                    color: #94a3b8;
                    padding: 1.5rem;
                    margin-top: 2rem;
                    border-top: 1px solid #334155;
                }
                
                .footer-content {
                    max-width: 1200px;
                    margin: 0 auto;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 1rem;
                }
                
                .footer-links {
                    display: flex;
                    gap: 1.5rem;
                }
                
                .footer-links a {
                    color: #94a3b8;
                    text-decoration: none;
                    transition: color 0.2s;
                }
                
                .footer-links a:hover {
                    color: #3b82f6;
                }
                
                .copyright {
                    font-size: 0.875rem;
                    text-align: center;
                }
                
                @media (min-width: 768px) {
                    .footer-content {
                        flex-direction: row;
                        justify-content: space-between;
                    }
                }
            </style>
            
            <footer>
                <div class="footer-content">
                    <div class="copyright">
                        &copy; ${new Date().getFullYear()} BossTrack Pro. All rights reserved.
                    </div>
                    <div class="footer-links">
                        <a href="#"><i data-feather="github" class="w-4 h-4 inline mr-1"></i> GitHub</a>
                        <a href="#"><i data-feather="help-circle" class="w-4 h-4 inline mr-1"></i> Help</a>
                        <a href="#"><i data-feather="mail" class="w-4 h-4 inline mr-1"></i> Contact</a>
                    </div>
                </div>
            </footer>
        `;
        
        // Replace feather icons
        setTimeout(() => {
            feather.replace();
        }, 0);
    }
}

customElements.define('custom-footer', CustomFooter);