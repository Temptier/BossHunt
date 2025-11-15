import React, { useState } from 'react';
import { MessageSquare, Save } from 'lucide-react';
import Swal from 'sweetalert2';

function WebhookPanel({ onSave }) {
  const [webhookUrl, setWebhookUrl] = useState('');

  const handleSave = () => {
    if (!webhookUrl) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid URL',
        text: 'Please enter a webhook URL',
        confirmButtonColor: '#dc2626'
      });
      return;
    }

    if (!webhookUrl.includes('discord.com/api/webhooks')) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid URL',
        text: 'Please enter a valid Discord webhook URL',
        confirmButtonColor: '#dc2626'
      });
      return;
    }

    onSave(webhookUrl);
    Swal.fire({
      icon: 'success',
      title: 'Webhook Saved',
      text: 'Discord webhook has been configured',
      confirmButtonColor: '#22c55e'
    });
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-5 h-5 text-accent-600" />
        <h2 className="text-xl font-bold text-neutral-900">Discord Webhook</h2>
      </div>

      <p className="text-neutral-600 mb-4">
        Enter your Discord webhook URL to receive notifications
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://discord.com/api/webhooks/..."
          className="flex-1 px-4 py-3 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-transparent"
        />
        <button
          onClick={handleSave}
          className="bg-accent-600 text-white px-6 py-3 rounded-lg hover:bg-accent-700 transition-colors flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          Save
        </button>
      </div>
    </div>
  );
}

export default WebhookPanel;
