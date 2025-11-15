import React, { useState, useEffect } from 'react';
import { Plus, Settings } from 'lucide-react';
import WelcomeModal from './components/WelcomeModal';
import AddBossModal from './components/AddBossModal';
import ManualTimer from './components/ManualTimer';
import ScheduledTimer from './components/ScheduledTimer';
import TodaySchedule from './components/TodaySchedule';
import WebhookPanel from './components/WebhookPanel';
import ControlRoom from './components/ControlRoom';
import StopAllButton from './components/StopAllButton';
import { storage } from './utils/storage';
import Swal from 'sweetalert2';

function App() {
  const [showWelcome, setShowWelcome] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [showAddManual, setShowAddManual] = useState(false);
  const [showAddScheduled, setShowAddScheduled] = useState(false);
  const [manualBosses, setManualBosses] = useState([]);
  const [scheduledBosses, setScheduledBosses] = useState([]);
  const [webhookUrl, setWebhookUrl] = useState('');

  // --- Fix localStorage load
  useEffect(() => {
    try {
      const savedUserInfo = storage.get('userInfo');
      const savedManualBosses = storage.get('manualBosses') || [];
      const savedScheduledBosses = storage.get('scheduledBosses') || [];
      const savedWebhook = storage.get('webhookUrl') || '';

      if (savedUserInfo) setUserInfo(savedUserInfo);
      else setShowWelcome(true);

      setManualBosses(savedManualBosses);
      setScheduledBosses(savedScheduledBosses);
      setWebhookUrl(savedWebhook);
    } catch (err) {
      console.error('Storage load error:', err);
    }
  }, []);

  // --- Handlers
  const handleWelcomeSubmit = (data) => {
    setUserInfo(data);
    storage.set('userInfo', data);
    setShowWelcome(false);
  };

  const handleAddManualBoss = (boss) => {
    const newBosses = [...manualBosses, boss];
    setManualBosses(newBosses);
    storage.set('manualBosses', newBosses);
  };

  const handleAddScheduledBoss = (boss) => {
    const exists = scheduledBosses.some(b => 
      b.name === boss.name && 
      b.respawnDay === boss.respawnDay &&
      b.respawnHour === boss.respawnHour &&
      b.respawnMinute === boss.respawnMinute
    );

    if (exists) {
      Swal.fire({
        icon: 'info',
        title: 'Boss Already Exists',
        text: 'This boss is already in the schedule',
        confirmButtonColor: '#3b82f6'
      });
      return;
    }

    const newBosses = [...scheduledBosses, boss];
    setScheduledBosses(newBosses);
    storage.set('scheduledBosses', newBosses);
  };

  const handleDeleteManual = (index) => {
    const newBosses = manualBosses.filter((_, i) => i !== index);
    setManualBosses(newBosses);
    storage.set('manualBosses', newBosses);
  };

  const handleDeleteScheduled = (index) => {
    const newBosses = scheduledBosses.filter((_, i) => i !== index);
    setScheduledBosses(newBosses);
    storage.set('scheduledBosses', newBosses);
  };

  const handleStopAll = () => {
    setManualBosses([]);
    setScheduledBosses([]);
    storage.remove('manualBosses');
    storage.remove('scheduledBosses');
  };

  const handleSaveWebhook = (url) => {
    setWebhookUrl(url);
    storage.set('webhookUrl', url);
  };

  const handleEditInfo = () => setShowWelcome(true);

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100">
      {showWelcome && (
        <WelcomeModal 
          onClose={() => userInfo && setShowWelcome(false)}
          onSubmit={handleWelcomeSubmit}
        />
      )}

      {showAddManual && (
        <AddBossModal
          type="manual"
          onClose={() => setShowAddManual(false)}
          onAdd={handleAddManualBoss}
        />
      )}

      {showAddScheduled && (
        <AddBossModal
          type="scheduled"
          onClose={() => setShowAddScheduled(false)}
          onAdd={handleAddScheduledBoss}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900 mb-2">
                Boss Spawn Timer
              </h1>
              {userInfo && (
                <p className="text-neutral-600">
                  IGN: {userInfo.ign} | Guild: {userInfo.guild}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleEditInfo}
                className="text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                <Settings className="w-6 h-6" />
              </button>
              <StopAllButton onStopAll={handleStopAll} />
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-neutral-900">Manual Timers</h2>
                <button
                  onClick={() => setShowAddManual(true)}
                  className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Boss
                </button>
              </div>

              {manualBosses.length === 0 ? (
                <p className="text-neutral-500 text-center py-8">
                  No manual timers yet. Click Add Boss to create one.
                </p>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {manualBosses.map((boss, index) => (
                    <ManualTimer key={index} boss={boss} onDelete={() => handleDeleteManual(index)} />
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-neutral-900">Scheduled Timers</h2>
                <button
                  onClick={() => setShowAddScheduled(true)}
                  className="bg-accent-600 text-white px-4 py-2 rounded-lg hover:bg-accent-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Boss
                </button>
              </div>

              {scheduledBosses.length === 0 ? (
                <p className="text-neutral-500 text-center py-8">
                  No scheduled timers yet. Click Add Boss to create one.
                </p>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {scheduledBosses.map((boss, index) => (
                    <ScheduledTimer key={index} boss={boss} onDelete={() => handleDeleteScheduled(index)} />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <TodaySchedule scheduledBosses={scheduledBosses} />
            <WebhookPanel onSave={handleSaveWebhook} />
            {webhookUrl && (
              <ControlRoom
                manualBosses={manualBosses}
                scheduledBosses={scheduledBosses}
                webhookUrl={webhookUrl}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;