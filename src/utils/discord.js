import { useState, useEffect, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';

export const useTimer = (targetTime) => {
  const [timeRemaining, setTimeRemaining] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  export const sendDiscordWebhook = async (webhookUrl, content) => {
  if (!webhookUrl) return false;
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        username: 'Boss Timer Bot',
        avatar_url: 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=100'
      })
    });
    return response.ok;
  } catch (error) {
    console.error("Discord webhook error:", error);
    return false;
  }
};

export const formatBossNotification = (boss, timeRemaining) => {
  return `**${boss.name}** will spawn in ${timeRemaining}!`;
};

