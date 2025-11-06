class CustomWelcomeModal extends HTMLElement {
    connectedCallback() {
        const userData = JSON.parse(localStorage.getItem('userData'));
        const visible = !userData ? 'flex' : 'hidden';
        this.innerHTML = `
        <div id="welcomeModal" class="${visible} fixed inset-0 items-center justify-center z-50 modal-overlay">
            <div class="bg-gray-800 rounded-xl shadow-lg w-11/12 max-w-md p-6 relative">
                <h2 class="text-2xl font-semibold mb-4">Welcome to Bossy McBossFace!</h2>
                <p class="text-gray-400 mb-4">Please enter your details to get started:</p>

                <div class="space-y-3">
                    <div>
                        <label class="block text-sm text-gray-300 mb-1">In-Game Name (IGN)</label>
                        <input type="text" id="ignInput" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white" placeholder="Your IGN">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-300 mb-1">Guild</label>
                        <input type="text" id="guildInput" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white" placeholder="Your Guild">
                    </div>
                </div>

                <div class="flex justify-end space-x-3 mt-6">
                    <button id="saveUserInfo" class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg">Save</button>
                </div>

                <button id="closeWelcome" class="absolute top-3 right-3 text-gray-400 hover:text-gray-200">
                    <i data-feather="x"></i>
                </button>
            </div>
        </div>
        `;
        feather.replace();
        this.initEvents();
    }

    initEvents() {
        const saveBtn = this.querySelector('#saveUserInfo');
        const closeBtn = this.querySelector('#closeWelcome');
        const modal = this.querySelector('#welcomeModal');

        saveBtn.addEventListener('click', () => {
            const ign = this.querySelector('#ignInput').value.trim();
            const guild = this.querySelector('#guildInput').value.trim();
            if (!ign || !guild) {
                alert('Please fill out both IGN and Guild.');
                return;
            }

            const userData = { ign, guild, userId: ign.toLowerCase().replace(/\s+/g, '-') };
            localStorage.setItem('userData', JSON.stringify(userData));
            modal.classList.add('hidden');
            alert(`Welcome ${ign} of ${guild}!`);
        });

        closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    }
}

customElements.define('custom-welcome-modal', CustomWelcomeModal);