import React, { useState } from 'react';
import { X } from 'lucide-react';
import Swal from 'sweetalert2';

function WelcomeModal({ onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    ign: '',
    guild: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.ign || !formData.guild) {
      Swal.fire({
        icon: 'error',
        title: 'Missing Information',
        text: 'Please fill in all fields',
        confirmButtonColor: '#dc2626'
      });
      return;
    }

    onSubmit(formData);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-bold text-neutral-900 mb-2">
          Welcome to Boss Timer
        </h2>
        <p className="text-neutral-600 mb-6">
          Please provide your information to get started
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="ign" className="block text-sm font-semibold text-neutral-700 mb-2">
              IGN (In-Game Name)
            </label>
            <input
              type="text"
              id="ign"
              name="ign"
              value={formData.ign}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              placeholder="Enter your IGN"
            />
          </div>

          <div>
            <label htmlFor="guild" className="block text-sm font-semibold text-neutral-700 mb-2">
              Guild
            </label>
            <input
              type="text"
              id="guild"
              name="guild"
              value={formData.guild}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              placeholder="Enter your guild name"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-primary-600 text-white font-semibold py-3 rounded-lg hover:bg-primary-700 transition-colors"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}

export default WelcomeModal;
