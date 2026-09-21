import React, { useState } from 'react';
import { ROLES } from '../utils/auth';
import { supabase } from '../utils/supabase';

export default function CompleteProfileView({ currentUser, onComplete }) {
  const [role, setRole] = useState('screener');
  const [staffId, setStaffId] = useState('');
  const [station, setStation] = useState('CHC Station / PHC Hub');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!station.trim()) {
      setErrorMessage('Please enter your Hospital / Station Facility Location.');
      return;
    }

    setIsSubmitting(true);

    try {
      const roleConfig = ROLES[role] || ROLES.screener;
      const updatedUser = {
        ...currentUser,
        roleId: role,
        role: roleConfig.label,
        roleBadge: roleConfig.badge,
        staffId: staffId || `NER-${roleConfig.id.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
        station: station.trim(),
        profileCompleted: true
      };
      
      // Update Supabase user metadata
      await supabase.auth.updateUser({
        data: {
          role_id: role,
          station: station.trim(),
          staff_id: updatedUser.staffId,
          profile_completed: true
        }
      });
      
      // Attempt to save to local session so it persists on reload
      const sessionKey = 'oa_ner_auth_session';
      sessionStorage.setItem(sessionKey, JSON.stringify(updatedUser));
      
      // Simulate slight network delay
      setTimeout(() => {
        setIsSubmitting(false);
        onComplete(updatedUser);
      }, 600);
    } catch (err) {
      setIsSubmitting(false);
      setErrorMessage(err.message || 'Failed to complete profile. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-background font-body-md text-on-surface flex flex-col justify-center items-center px-4 py-8 animate-fade-in selection:bg-primary-fixed selection:text-on-primary-fixed">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-xl border border-surface-container p-6 sm:p-8">
        
        {/* Header */}
        <div className="text-center mb-6 pb-6 border-b border-surface-container">
          <div className="w-16 h-16 mx-auto bg-inverse-surface border border-white/15 rounded-2xl shadow-md p-2 flex items-center justify-center mb-4">
            <img
              src="/logo.png"
              alt="OrthoNex Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="font-headline-sm text-xl font-bold text-on-surface mb-2 tracking-tight">
            Complete Your Profile
          </h1>
          <p className="font-body-sm text-secondary text-xs">
            Welcome, <strong>{currentUser?.name || currentUser?.email || 'Practitioner'}</strong>.
            <br />
            Please provide your operational details to access the station.
          </p>
        </div>

        {/* Error Notification Alert */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-xl bg-error-container/30 border border-error/50 text-on-surface flex items-start gap-3 animate-fade-in"
          >
            <span className="material-symbols-outlined text-error text-[20px] shrink-0 mt-0.5">
              error
            </span>
            <div className="flex-1">
              <span className="font-label-md text-xs font-bold text-error block mb-0.5">
                Profile Update Alert
              </span>
              <p className="font-body-sm text-xs text-on-surface">
                {errorMessage}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* Email (Readonly) */}
          <div>
            <label className="block font-label-sm text-[11px] text-on-surface-variant font-bold uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <input
              type="text"
              readOnly
              value={currentUser?.email || ''}
              className="w-full bg-surface-container/50 text-on-surface-variant text-xs rounded-xl px-4 py-3 border border-surface-container cursor-not-allowed font-data-mono"
            />
          </div>

          {/* Role Selection */}
          <div>
            <label className="block font-label-sm text-[11px] text-on-surface-variant font-bold uppercase tracking-wider mb-1.5">
              Assigned Operational Role *
            </label>
            <div className="grid grid-cols-3 gap-2 p-1.5 rounded-xl bg-surface-container-low border border-surface-container">
              {Object.values(ROLES).map((r) => {
                const isSelected = role === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-primary text-on-primary shadow-sm font-semibold'
                        : 'text-secondary hover:text-on-surface hover:bg-white/60'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px] mb-1">{r.icon}</span>
                    <span className="font-label-sm text-[10px] leading-tight block">
                      {r.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Station/Location */}
          <div>
            <label className="block font-label-sm text-[11px] text-on-surface-variant font-bold uppercase tracking-wider mb-1.5">
              Hospital / Station Facility Location *
            </label>
            <input
              type="text"
              required
              value={station}
              onChange={(e) => setStation(e.target.value)}
              placeholder="e.g., Safdarjung Hospital Delhi"
              className="w-full bg-surface-container-low text-on-surface placeholder:text-outline text-xs rounded-xl px-4 py-3 border border-surface-container focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition"
            />
          </div>

          {/* Staff ID */}
          <div>
            <label className="block font-label-sm text-[11px] text-on-surface-variant font-bold uppercase tracking-wider mb-1.5">
              Staff / Registration ID (Optional)
            </label>
            <input
              type="text"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              placeholder="Leave blank to auto-generate"
              className="w-full bg-surface-container-low text-on-surface placeholder:text-outline text-xs rounded-xl px-4 py-3 border border-surface-container focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition font-data-mono"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3 px-4 rounded-xl font-label-md text-sm font-bold text-on-primary bg-primary hover:bg-primary-container shadow-md transition-all flex items-center justify-center gap-2 ${
                isSubmitting ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'
              }`}
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
                  <span>Saving Profile...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  <span>Complete Profile & Enter Station</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
