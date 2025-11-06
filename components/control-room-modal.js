class CustomControlRoomModal extends HTMLElement {
    connectedCallback() {
        this.render();
    }

    render() {
        this.innerHTML = `
        <div id="controlRoomModal" class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 hidden z-50">
            <div class="bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-6">
                <h2 class="text-2xl font-bold mb-4 text-center">Control Room</h2>

                <div class="max-h-64 overflow-y-auto mb-4 border border-gray-700 rounded-lg">
                    <ul id="bossListContainer" class="divide-y divide-gray-700"></ul>
                </div>

                <div class="mb-4">
                    <label class="block text-sm font-medium mb-1 text-gray-300">Optional Message</label>
                    <input type="text" id="optionalMessage" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-gray-200" placeholder="Enter message (optional)">
                </div>

                <div class="flex justify-end space-x-3">
                    <button id="closeControlRoom" class="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-lg">Cancel</button>
                    <button id="sendToDiscord" class="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg">Send</button>
                </div>
            </div>
        </div>
        `;

        this.querySelector('#closeControlRoom').addEventListener('click', () => {
            this.hide();
        });

        this.querySelector('#sendToDiscord').addEventListener('click', () => {
            this.sendSelectedToDiscord();
        });
    }

    show() {
        this.renderBossList();
        document.getElementById('controlRoomModal').classList.remove('hidden');
    }

    hide() {
        document.getElementById('controlRoomModal').classList.add('hidden');
    }

    renderBossList() {
        const container = this.querySelector('#bossListContainer');
        container.innerHTML = '';

        const now = new Date();
        const todayStr = now.toDateString();

        if (!timers || timers.length === 0) {
            container.innerHTML = `<li class="p-4 text-center text-gray-500">No timers available.</li>`;
            return;
        }

        timers.forEach(timer => {
            let nextSpawn;
            let isToday = false;

            if (timer.type === 'manual' && timer.lastKilled && timer.respawnTime) {
                nextSpawn = new Date(timer.lastKilled);
                nextSpawn.setHours(nextSpawn.getHours() + timer.respawnTime);
                isToday = nextSpawn.toDateString() === todayStr;
            }

            if (timer.type === 'scheduled' && timer.spawnDays && timer.spawnTime) {
                const spawnDay = timer.spawnDays.includes(now.getDay());
                if (spawnDay) {
                    const [time, period] = timer.spawnTime.split(' ');
                    let [hour, minute] = time.split(':').map(Number);
                    if (period === 'PM' && hour < 12) hour += 12;
                    if (period === 'AM' && hour === 12) hour = 0;

                    nextSpawn = new Date(now);
                    nextSpawn.setHours(hour, minute, 0, 0);
                    isToday = true;
                }
            }

            const color = isToday ? 'text-green-400' : 'text-blue-400';
            const nextSpawnText = nextSpawn
                ? nextSpawn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '--:--';

            const li = document.createElement('li');
            li.className = `flex justify-between items-center p-3 hover:bg-gray-700 transition-colors duration-200`;
            li.innerHTML = `
                <div>
                    <p class="font-semibold ${color}">${timer.bossName}</p>
                    <p class="text-sm text-gray-400">Next Spawn: ${nextSpawnText}</p>
                </div>
                <input type="checkbox" class="bossCheckbox h-5 w-5 accent-green-500" data-id="${timer.id}" data-name="${timer.bossName}" data-next="${nextSpawnText}">
            `;
            container.appendChild(li);
        });
    }

    async sendSelectedToDiscord() {
        const checkboxes = this.querySelectorAll('.bossCheckbox:checked');
        if (checkboxes.length === 0) {
            alert('Please select at least one boss.');
            return;
        }

        const optionalMessage = this.querySelector('#optionalMessage').value.trim();
        const messageList = [];

        checkboxes.forEach(cb => {
            messageList.push({
                boss: cb.dataset.name,
                time: cb.dataset.next,
            });
        });

        const webhookUrl = localStorage.getItem('webhookUrl');
        const adminWebhookUrl = localStorage.getItem('adminWebhookUrl');

        if (!webhookUrl) {
            alert('Please set your Discord Webhook first.');
            return;
        }

        // Send to Discord
        for (const msg of messageList) {
            const payload = {
                content: "@everyone",
                embeds: [
                    {
                        title: `${msg.boss}`,
                        description: `🕒 **Next Spawn:** ${msg.time}\n${optionalMessage ? `💬 ${optionalMessage}` : ''}`,
                        color: 0x00ff00
                    }
                ]
            };

            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // Log to Admin webhook
            if (adminWebhookUrl) {
                const logPayload = {
                    content: `📢 **Sent Boss Notification:** ${msg.boss} (${msg.time}) by ${userData?.ign || 'Unknown User'}`
                };
                await fetch(adminWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(logPayload)
                });
            }
        }

        alert('Boss notifications sent to Discord!');
        this.hide();
    }
}

customElements.define('custom-control-room-modal', CustomControlRoomModal);