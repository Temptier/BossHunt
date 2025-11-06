class CustomAddBossModal extends HTMLElement {
    connectedCallback() {
        this.render();
        this.attachEvents();
    }

    render() {
        this.innerHTML = `
            <div id="addBossModal" class="hidden fixed inset-0 z-50 flex items-center justify-center">
                <div class="modal-overlay absolute inset-0 bg-black bg-opacity-70"></div>
                <div class="bg-gray-800 rounded-xl shadow-lg p-6 z-10 w-full max-w-md">
                    <h2 id="modalTitle" class="text-2xl font-semibold mb-4">Add Boss Timer</h2>
                    
                    <form id="addBossForm" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-1">Boss Name</label>
                            <input type="text" id="bossName" required class="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-1">Respawn Time (minutes)</label>
                            <input type="number" id="respawnTime" min="1" required class="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>

                        <!-- Manual Timer Fields -->
                        <div id="manualFields" class="hidden">
                            <label class="inline-flex items-center space-x-2">
                                <input type="checkbox" id="autoRestart" class="form-checkbox text-blue-500">
                                <span>Auto-restart if missed</span>
                            </label>
                        </div>

                        <!-- Scheduled Timer Fields -->
                        <div id="scheduledFields" class="hidden space-y-3">
                            <div>
                                <label class="block text-sm font-medium text-gray-300 mb-1">Day of Week</label>
                                <select id="spawnDay" class="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500">
                                    <option value="Sunday">Sunday</option>
                                    <option value="Monday">Monday</option>
                                    <option value="Tuesday">Tuesday</option>
                                    <option value="Wednesday">Wednesday</option>
                                    <option value="Thursday">Thursday</option>
                                    <option value="Friday">Friday</option>
                                    <option value="Saturday">Saturday</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-300 mb-1">Spawn Time</label>
                                <input type="time" id="spawnTime" required class="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500">
                            </div>
                        </div>

                        <div class="flex justify-end space-x-3 mt-6">
                            <button type="button" id="cancelAddBoss" class="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-lg">Cancel</button>
                            <button type="submit" id="saveBossBtn" class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg">Save</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }

    attachEvents() {
        const modal = this.querySelector('#addBossModal');
        const form = this.querySelector('#addBossForm');
        const manualFields = this.querySelector('#manualFields');
        const scheduledFields = this.querySelector('#scheduledFields');
        const modalTitle = this.querySelector('#modalTitle');

        // Buttons from main page
        document.getElementById('addManualTimer')?.addEventListener('click', () => {
            this.timerType = 'manual';
            manualFields.classList.remove('hidden');
            scheduledFields.classList.add('hidden');
            modalTitle.textContent = "Add Manual Boss";
            modal.classList.remove('hidden');
        });

        document.getElementById('addScheduledTimer')?.addEventListener('click', () => {
            this.timerType = 'scheduled';
            manualFields.classList.add('hidden');
            scheduledFields.classList.remove('hidden');
            modalTitle.textContent = "Add Scheduled Boss";
            modal.classList.remove('hidden');
        });

        // Cancel button
        this.querySelector('#cancelAddBoss').addEventListener('click', () => {
            modal.classList.add('hidden');
            form.reset();
        });

        // Save form
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = this.querySelector('#bossName').value.trim();
            const respawnTime = parseInt(this.querySelector('#respawnTime').value);
            const autoRestart = this.querySelector('#autoRestart').checked;
            const spawnDay = this.querySelector('#spawnDay')?.value;
            const spawnTime = this.querySelector('#spawnTime')?.value;

            const timerData = {
                bossName: name,
                type: this.timerType,
                createdAt: firebase.firestore.Timestamp.now(),
            };

            if (this.timerType === 'manual') {
                Object.assign(timerData, {
                    respawnMinutes: respawnTime,
                    autoRestart,
                    active: false,
                    missCount: 0,
                    lastKilled: null
                });
            } else {
                Object.assign(timerData, {
                    respawnMinutes: respawnTime,
                    spawnDay,
                    spawnTime,
                });
            }

            try {
                await firebase.firestore().collection('timers').add(timerData);
                console.log(`✅ Added ${this.timerType} timer:`, name);
                modal.classList.add('hidden');
                form.reset();
            } catch (err) {
                console.error("❌ Error adding timer:", err);
                alert("Failed to add boss timer. Check console for details.");
            }
        });
    }
}

customElements.define('custom-add-boss-modal', CustomAddBossModal);