import React from 'react';
import { StopCircle } from 'lucide-react';
import Swal from 'sweetalert2';

function StopAllButton({ onStopAll }) {
  const handleClick = () => {
    Swal.fire({
      title: 'Stop All Timers',
      text: 'Enter password to stop all timers',
      input: 'password',
      inputPlaceholder: 'Enter password',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Stop All'
    }).then((result) => {
      if (result.isConfirmed) {
        if (result.value === 'theworldo') {
          onStopAll();
          Swal.fire({
            icon: 'success',
            title: 'Stopped',
            text: 'All timers have been stopped',
            confirmButtonColor: '#22c55e'
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Incorrect Password',
            text: 'Please try again',
            confirmButtonColor: '#dc2626'
          });
        }
      }
    });
  };

  return (
    <button
      onClick={handleClick}
      className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 font-semibold"
    >
      <StopCircle className="w-5 h-5" />
      Stop All Timers
    </button>
  );
}

export default StopAllButton;
