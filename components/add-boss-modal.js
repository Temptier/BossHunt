class CustomAddBossModal extends HTMLElement {
  connectedCallback() {
    this.render();
    this.querySelector("#closeAddBoss").addEventListener("click", () => this.hide());
    this.querySelector("#saveBoss").addEventListener("click", () => this.saveBoss());
    this.querySelector("#bossType").addEventListener("change", (e) => this.toggleType(e.target.value));
  }

  show(type = "manual") {
    this.querySelector("#bossType").value = type;
    this.toggleType(type);
    this.classList.remove("hidden");
  }

  hide() {
    this.classList.add("hidden");
  }

  toggleType(type) {
    const manualSection = this.querySelector("#manualSection");
    const scheduledSection = this.querySelector("#scheduledSection");
    manualSection.classList.toggle("hidden", type !== "manual");
    scheduledSection.classList.toggle("hidden", type !== "scheduled");
  }

  async saveBoss() {
    const bossType = this.querySelector("#bossType").value;
    const bossName = this.querySelector("#bossName").value.trim();

    if (!bossName) {
      alert("Please enter a boss name");
      return;
    }

    const baseData = {
      bossName,
      userId: userData.userId,
      createdAt: firebase.firestore.Timestamp.now(),
    };

    let timerData = {};

    if (bossType === "manual") {
      const respawnTime = parseInt(this.querySelector("#manualRespawn").value) || 60;
      const autoRestart = this.querySelector("#autoRestart").checked;

      timerData = {
        ...baseData,
        type: "manual",
        respawnTime,
        autoRestart,
        missCount: 0,
        lastKilled: firebase.firestore.Timestamp.now(),
        active: true,
      };
    } else {
      const spawnDays = Array.from(this.querySelectorAll("input[name='spawnDays']:checked")).map(d => parseInt(d.value));
      const spawnTime = this.querySelector("#spawnTime").value;
      const spawnWindow = parseInt(this.querySelector("#spawnWindow").value) || 30;

      timerData = {
        ...baseData,
        type: "scheduled",
        spawnDays,            // e.g. [1, 3, 5]
        spawnTime,            // e.g. "14:30"
        spawnWindow,          // minutes window
        lastSpawned: firebase.firestore.Timestamp.now(),
      };
    }

    try {
      await db.collection("timers").add(timerData);
      logAdminAction("Added Timer", `Boss: ${bossName} (${bossType})`);
      sendToUserWebhook(`🆕 Added ${bossType} timer for **${bossName}**`);
      this.hide();
    } catch (err) {
      console.error("Error adding boss:", err);
      alert("Failed to add boss. Check console for details.");
    }
  }

  render() {
    this.innerHTML = `
      <div class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center hidden">
        <div class="bg-gray-800 rounded-xl p-6 w-full max-w-md relative">
          <button id="closeAddBoss" class="absolute top-3 right-3 text-gray-400 hover:text-gray-200">
            <i data-feather="x"></i>
          </button>

          <h2 class="text-2xl font-semibold mb-4">Add Boss Timer</h2>

          <label class="block mb-2 text-sm font-medium">Boss Name</label>
          <input id="bossName" type="text" class="w-full mb-4 p-2 rounded bg-gray-700 border border-gray-600" placeholder="Enter boss name">

          <label class="block mb-2 text-sm font-medium">Timer Type</label>
          <select id="bossType" class="w-full mb-4 p-2 rounded bg-gray-700 border border-gray-600">
            <option value="manual">Manual Timer</option>
            <option value="scheduled">Scheduled Timer</option>
          </select>

          <!-- Manual Timer Section -->
          <div id="manualSection">
            <label class="block mb-2 text-sm font-medium">Respawn Time (minutes)</label>
            <input id="manualRespawn" type="number" class="w-full mb-4 p-2 rounded bg-gray-700 border border-gray-600" value="60">

            <label class="flex items-center space-x-2 mb-4">
              <input id="autoRestart" type="checkbox" class="w-4 h-4 text-blue-600 border-gray-600 rounded">
              <span class="text-sm">Auto-restart if missed</span>
            </label>
          </div>

          <!-- Scheduled Timer Section -->
          <div id="scheduledSection" class="hidden">
            <label class="block mb-2 text-sm font-medium">Spawn Days</label>
            <div class="grid grid-cols-4 gap-2 mb-4 text-sm">
              <label><input type="checkbox" name="spawnDays" value="0"> Sun</label>
              <label><input type="checkbox" name="spawnDays" value="1"> Mon</label>
              <label><input type="checkbox" name="spawnDays" value="2"> Tue</label>
              <label><input type="checkbox" name="spawnDays" value="3"> Wed</label>
              <label><input type="checkbox" name="spawnDays" value="4"> Thu</label>
              <label><input type="checkbox" name="spawnDays" value="5"> Fri</label>
              <label><input type="checkbox" name="spawnDays" value="6"> Sat</label>
            </div>

            <label class="block mb-2 text-sm font-medium">Spawn Time</label>
            <input id="spawnTime" type="time" class="w-full mb-4 p-2 rounded bg-gray-700 border border-gray-600">

            <label class="block mb-2 text-sm font-medium">Spawn Window (minutes)</label>
            <input id="spawnWindow" type="number" class="w-full mb-4 p-2 rounded bg-gray-700 border border-gray-600" value="30">
          </div>

          <div class="flex justify-end mt-6">
            <button id="saveBoss" class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg">Save</button>
          </div>
        </div>
      </div>
    `;
    feather.replace();
  }
}

customElements.define("custom-add-boss-modal", CustomAddBossModal);