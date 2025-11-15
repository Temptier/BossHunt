import React, { useState, useEffect } from 'react';
import { Play, RotateCcw, Trash2 } from 'lucide-react';
import { useTimer } from '../hooks/useTimer';
import { format } from 'date-fns';
import Swal from 'sweetalert2';

function ManualTimer({ boss, onDelete, onRestart }) {
  const [targetTime, setTargetTime] = useState(null);
  const [lastKilled, setLastKilled] = useState(null);
  const [missCount, setMissCount] = useState(0);
  const { timeRemaining, isExpired } = useTimer(targetTime);

  useEffect(() => {
    if (isExpired && targetTime && boss.enableAutoReset && boss.autoResetMinutes) {
      const timeSinceExpiry = new Date().getTime() - new Date(targetTime).getTime();
      const autoResetMs = boss.autoResetMinutes * 60 * 1000;
      if (timeSinceExpiry >= autoResetMs) {
        handleAutoReset();
      }
    }
  }, [isExpired, targetTime, boss]);

  const handleAutoReset = () => {
    setMissCount(prev => prev + 1);
    const newTarget = new Date(new Date().getTime() + boss.respawnTime * 60 * 1000);
    setTargetTime(newTarget);
    setLastKilled(new Date());
  };

  const handleStart = () => {
    const newTarget = new Date(new Date().getTime() + boss.respawnTime * 60 * 1000);
    setTargetTime(newTarget);
    setLastKilled(new Date());
  };

  const handleRestart = () => {
    setMissCount(0);
    const newTarget = new Date(new Date().getTime() + boss.respawnTime * 60 * 1000);
    setTargetTime(newTarget);
    setLastKilled(new Date());
    onRestart && onRestart();
  };

  const handleDelete = () => {
    Swal.fire({
      title: 'Delete Timer?',
      text: `Are you sure you want to delete the timer for ${boss.name}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it'
    }).then((result) => {
      if (result.isConfirmed) {
        onDelete();
      }
    });
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-neutral-900">{boss.name}</h3>
          <p className="text-sm text-neutral-600">
            Respawn: {boss.respawnTime} minutes
          </p>
          {lastKilled && (
            <p className="text-xs text-neutral-500 mt-1">
              Last killed: {format(lastKilled, 'PPpp')}
            </p>
          )}
        </div>
        <button
          onClick={handleDelete}
          className="text-neutral-400 hover:text-primary-600 transition-colors"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex-1">
          {targetTime ? (
            <div>
              <p className={`text-2xl font-bold ${isExpired ? 'text-green-600' : 'text-primary-600'}`}>
                {timeRemaining}
              </p>
              {missCount > 0 && (
                <p className="text-sm text-orange-600 mt-1">
                  Missed: {missCount}
                </p>
              )}
            </div>
          ) : (
            <p className="text-neutral-500">Not started</p>
          )}
        </div>

        <div className="flex gap-2">
          {!targetTime ? (
            <button
              onClick={handleStart}
              className="bg-primary-600 text-white p-3 rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Play className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleRestart}
              className="bg-accent-600 text-white p-3 rounded-lg hover:bg-accent-700 transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ManualTimer;
