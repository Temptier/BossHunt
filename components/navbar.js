class CustomNavbar extends HTMLElement {
  connectedCallback(){
    this.innerHTML = `
    <nav class="bg-gray-800 p-4 mb-6 flex justify-between">
      <span class="text-xl font-bold text-gray-100">Boss Timer</span>
      <a href="admin.html" class="text-gray-300 hover:text-white">Admin</a>
    </nav>`;
  }
}
customElements.define('custom-navbar', CustomNavbar);