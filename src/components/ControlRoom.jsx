import React, { useState } from 'react';
import { Send, Bell } from 'lucide-react';
import Swal from 'sweetalert2';
import { sendDiscordWebhook, formatBossNotification } from '../utils/discord';

function ControlRoom({ manualBosses, scheduledBosses, webhookUrl }) {
  const [selectedBosses, setSelectedBosses] = useState([]);
  const [message, setMessage] = useState('');

  const allBosses = [
    ...manualBosses.map(b => ({ ...b, type: 'manual' })),
    ...scheduledBosses.map(b => ({ ...b, type: 'scheduled' }))
  ];

  const handleToggleBoss = (index) => {
    setSelectedBosses(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const handleSend = async () => {
    if (selectedBosses.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'No Bosses Selected',
        text: 'Please select at least one boss to notify',
        confirmButtonColor: '#f59e0b'
      });
      return;
    }

    const bossNames = selectedBosses.map(i => allBosses[i].name).join(', ');
    const content = `${message}\n\nBosses: ${bossNames}`;

    const success = await sendDiscordWebhook(webhookUrl, content);

    if (success) {
      Swal.fire({
        icon: 'success',
        title: 'Sent!',
        text: 'Notification sent to Discord',
        confirmButtonColor: '#22c55e'
      });
      setSelectedBosses([]);
      setMessage('');
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Failed',
        text: 'Could not send notification',
        confirmButtonColor: '#dc2626'
      });
    }
  };

  const isTodayScheduled = (boss) => {
    if (boss.type !== 'scheduled') return false;
    return parseInt(boss.respawnDay) === new Date().getDay();
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Bell className="w-5 h-5 text-primary-600" />
        <h2 className="text-xl font-bold text-neutral-900">Control Room</h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            Select Bosses to Notify
          </label>
          <div className="grid grid-cols-2 gap-2">
            {allBosses.map((boss, index) => (
              <button
                key={index}
                onClick={() => handleToggleBoss(index)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedBosses.includes(index)
                    ? isTodayScheduled(boss)
                      ? 'bg-green-500 text-white'
                      : 'bg-accent-500 text-white'
                    : isTodayScheduled(boss)
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-accent-100 text-accent-700 hover:bg-accent-200'
                }`}
              >
                {boss.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            Optional Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Add a custom message..."
            rows={3}
            className="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
          />
        </div>

        <button
          onClick={handleSend}
          className="w-full bg-primary-600 text-white font-semibold py-3 rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" />
          Send Notification
        </button>
      </div>
    </div>
  );
}

export default ControlRoom;
