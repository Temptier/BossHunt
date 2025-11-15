import React, { useState } from 'react';
import { X } from 'lucide-react';
import Swal from 'sweetalert2';

function AddBossModal({ onClose, onAdd, type }) {
  const [formData, setFormData] = useState({
    name: '',
    respawnTime: '',
    respawnDay: '',
    respawnHour: '',
    respawnMinute: '',
    autoResetMinutes: '',
    enableAutoReset: false
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.name) {
      Swal.fire({
        icon: 'error',
        title: 'Missing Information',
        text: 'Please enter a boss name',
        confirmButtonColor: '#dc2626'
      });
      return;
    }

    if (type === 'manual' && !formData.respawnTime) {
      Swal.fire({
        icon: 'error',
        title: 'Missing Information',
        text: 'Please enter respawn time in minutes',
        confirmButtonColor: '#dc2626'
      });
      return;
    }

    if (type === 'scheduled' && (!formData.respawnDay || !formData.respawnHour || !formData.respawnMinute)) {
      Swal.fire({
        icon: 'error',
        title: 'Missing Information',
        text: 'Please fill in all schedule fields',
        confirmButtonColor: '#dc2626'
      });
      return;
    }

    onAdd(formData);
    onClose();
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-8 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-bold text-neutral-900 mb-2">
          Add {type === 'manual' ? 'Manual' : 'Scheduled'} Boss
        </h2>
        <p className="text-neutral-600 mb-6">
          {type === 'manual' 
            ? 'Create a timer that starts when you click'
            : 'Create a timer that spawns at specific times'
          }
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-neutral-700 mb-2">
              Boss Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter boss name"
            />
          </div>

          {type === 'manual' ? (
            <>
              <div>
                <label htmlFor="respawnTime" className="block text-sm font-semibold text-neutral-700 mb-2">
                  Respawn Time (minutes)
                </label>
                <input
                  type="number"
                  id="respawnTime"
                  name="respawnTime"
                  value={formData.respawnTime}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="60"
                  min="1"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enableAutoReset"
                  name="enableAutoReset"
                  checked={formData.enableAutoReset}
                  onChange={handleChange}
                  className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                />
                <label htmlFor="enableAutoReset" className="text-sm text-neutral-700">
                  Enable auto-reset
                </label>
              </div>

              {formData.enableAutoReset && (
                <div>
                  <label htmlFor="autoResetMinutes" className="block text-sm font-semibold text-neutral-700 mb-2">
                    Auto-reset after (minutes)
                  </label>
                  <input
                    type="number"
                    id="autoResetMinutes"
                    name="autoResetMinutes"
                    value={formData.autoResetMinutes}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="10"
                    min="1"
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <label htmlFor="respawnDay" className="block text-sm font-semibold text-neutral-700 mb-2">
                  Day of Week
                </label>
                <select
                  id="respawnDay"
                  name="respawnDay"
                  value={formData.respawnDay}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select day</option>
                  <option value="0">Sunday</option>
                  <option value="1">Monday</option>
                  <option value="2">Tuesday</option>
                  <option value="3">Wednesday</option>
                  <option value="4">Thursday</option>
                  <option value="5">Friday</option>
                  <option value="6">Saturday</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="respawnHour" className="block text-sm font-semibold text-neutral-700 mb-2">
                    Hour (0-23)
                  </label>
                  <input
                    type="number"
                    id="respawnHour"
                    name="respawnHour"
                    value={formData.respawnHour}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="14"
                    min="0"
                    max="23"
                  />
                </div>

                <div>
                  <label htmlFor="respawnMinute" className="block text-sm font-semibold text-neutral-700 mb-2">
                    Minute (0-59)
                  </label>
                  <input
                    type="number"
                    id="respawnMinute"
                    name="respawnMinute"
                    value={formData.respawnMinute}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="30"
                    min="0"
                    max="59"
                  />
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            className="w-full bg-primary-600 text-white font-semibold py-3 rounded-lg hover:bg-primary-700 transition-colors"
          >
            Add Boss
          </button>
        </form>
      </div>
    </div>
  );
}

export default AddBossModal;
