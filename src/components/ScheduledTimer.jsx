import React, { useState, useEffect } from 'react';
import { Trash2, Calendar } from 'lucide-react';
import { useTimer } from '../hooks/useTimer';
import Swal from 'sweetalert2';

function ScheduledTimer({ boss, onDelete }) {
  const [nextSpawn, setNextSpawn] = useState(null);
  const { timeRemaining, isExpired } = useTimer(nextSpawn);

  const calculateNextSpawn = () => {
    const now = new Date();
    const targetDay = parseInt(boss.respawnDay);
    const targetHour = parseInt(boss.respawnHour);
    const targetMinute = parseInt(boss.respawnMinute);

    let next = new Date();
    next.setHours(targetHour, targetMinute, 0, 0);

    const currentDay = now.getDay();
    let daysUntilTarget = (targetDay - currentDay + 7) % 7;

    if (daysUntilTarget === 0 && now >= next) {
      daysUntilTarget = 7;
    }

    next.setDate(next.getDate() + daysUntilTarget);
    return next;
  };

  useEffect(() => {
    setNextSpawn(calculateNextSpawn());
    const interval = setInterval(() => {
      if (isExpired) {
        setNextSpawn(calculateNextSpawn());
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [boss, isExpired]);

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

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-neutral-900">{boss.name}</h3>
          <p className="text-sm text-neutral-600 flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {dayNames[boss.respawnDay]} at {String(boss.respawnHour).padStart(2, '0')}:{String(boss.respawnMinute).padStart(2, '0')}
          </p>
        </div>
        <button
          onClick={handleDelete}
          className="text-neutral-400 hover:text-primary-600 transition-colors"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      <div>
        <p className={`text-2xl font-bold ${isExpired ? 'text-green-600' : 'text-accent-600'}`}>
          {timeRemaining}
        </p>
      </div>
    </div>
  );
}

export default ScheduledTimer;
