import React from 'react';
import { Calendar } from 'lucide-react';

function TodaySchedule({ scheduledBosses }) {
  const today = new Date().getDay();
  const todayBosses = scheduledBosses.filter(boss => parseInt(boss.respawnDay) === today);

  if (todayBosses.length === 0) {
    return (
      <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-accent-600" />
          <h2 className="text-xl font-bold text-neutral-900">Today's Schedule</h2>
        </div>
        <p className="text-neutral-600">No bosses scheduled for today</p>
      </div>
    );
  }

  return (
    <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-5 h-5 text-accent-600" />
        <h2 className="text-xl font-bold text-neutral-900">Today's Schedule</h2>
      </div>

      <div className="space-y-3">
        {todayBosses.map((boss, index) => (
          <div key={index} className="flex items-center justify-between bg-white p-4 rounded-lg">
            <span className="font-semibold text-neutral-900">{boss.name}</span>
            <span className="text-neutral-600">
              {String(boss.respawnHour).padStart(2, '0')}:{String(boss.respawnMinute).padStart(2, '0')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TodaySchedule;
