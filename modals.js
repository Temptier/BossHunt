// modals.js
export function showWelcomeModal(onSubmit) {
  Swal.fire({
    title: 'Welcome to Boss Timer',
    html: `
      <input id="ign" class="swal2-input" placeholder="IGN">
      <input id="guild" class="swal2-input" placeholder="Guild">
    `,
    confirmButtonText: 'Continue',
    preConfirm: () => {
      const ign = document.getElementById('ign').value.trim();
      const guild = document.getElementById('guild').value.trim();
      if (!ign || !guild) Swal.showValidationMessage('Please fill in all fields');
      return { ign, guild };
    }
  }).then(result => {
    if (result.isConfirmed) onSubmit(result.value);
  });
}

export function showAddBossModal(type, onAdd) {
  Swal.fire({
    title: `Add ${type} boss`,
    html: `
      <input id="bossName" class="swal2-input" placeholder="Boss Name">
      <input id="respawnDay" class="swal2-input" placeholder="Day (0=Sun)">
      <input id="respawnHour" class="swal2-input" placeholder="Hour (0-23)">
      <input id="respawnMinute" class="swal2-input" placeholder="Minute (0-59)">
      <input id="respawnMinutes" class="swal2-input" placeholder="Respawn in minutes">
    `,
    confirmButtonText: 'Add',
    preConfirm: () => {
      const boss = {
        name: document.getElementById('bossName').value.trim(),
        respawnDay: parseInt(document.getElementById('respawnDay').value),
        respawnHour: parseInt(document.getElementById('respawnHour').value),
        respawnMinute: parseInt(document.getElementById('respawnMinute').value),
        respawnMinutes: parseInt(document.getElementById('respawnMinutes').value)
      };
      if (!boss.name || isNaN(boss.respawnDay) || isNaN(boss.respawnHour) || isNaN(boss.respawnMinute) || isNaN(boss.respawnMinutes))
        Swal.showValidationMessage('Please fill all fields correctly');
      return boss;
    }
  }).then(result => {
    if (result.isConfirmed) onAdd(result.value);
  });
}

export function confirmDelete(name, onConfirm) {
  Swal.fire({
    title: `Delete ${name}?`,
    input: 'password',
    inputPlaceholder: 'Enter password',
    showCancelButton: true,
    confirmButtonText: 'Delete',
    preConfirm: (password) => {
      if (password !== 'theworldo') Swal.showValidationMessage('Incorrect password');
      return true;
    }
  }).then(result => {
    if (result.isConfirmed) onConfirm();
  });
}