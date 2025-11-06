class CustomNavbar extends HTMLElement {
  connectedCallback(){
    const current = window.location.pathname.split('/').pop() || 'index.html';
    this.innerHTML = `
      <nav class="bg-gray-800 shadow-lg">
        <div class="container mx-auto px-4 py-3 flex justify-between items-center">
          <a href="index.html" class="flex items-center space-x-2 text-xl font-bold text-white">
            <i data-feather="clock"></i>
            <span>Bossy McBossFace</span>
          </a>
          <div class="space-x-6">
            <a href="index.html" class="${current==='index.html'?'text-blue-400':'text-gray-300 hover:text-white'}">Home</a>
            <a href="admin.html" class="${current==='admin.html'?'text-blue-400':'text-gray-300 hover:text-white'}">Admin</a>
            <button id="themeToggle" class="text-gray-300 hover:text-white"><i data-feather="moon"></i></button>
          </div>
        </div>
      </nav>`;
    feather.replace();
    this.initTheme();
  }
  initTheme(){
    const btn = this.querySelector('#themeToggle');
    btn.addEventListener('click', () => {
      document.documentElement.classList.toggle('dark');
      feather.replace();
    });
  }
}
customElements.define('custom-navbar', CustomNavbar);