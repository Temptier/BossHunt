import { useState, useEffect, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';

export const useTimer = (targetTime) => {
  const [timeRemaining, setTimeRemaining] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  const updateTimer = useCallback(() => {
    if (!targetTime) return;

    const now = new Date().getTime();
    const target = new Date(targetTime).getTime();
    const diff = target - now;

    if (diff <= 0) {
      setIsExpired(true);
      setTimeRemaining('Spawned!');
      return;
    }

    setIsExpired(false);
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
  }, [targetTime]);

  useEffect(() => {
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [updateTimer]);

  return { timeRemaining, isExpired };
};
