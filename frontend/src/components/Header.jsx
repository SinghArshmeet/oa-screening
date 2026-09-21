import React, { useState, useRef, useEffect } from 'react';
import { ROLES, getRoleConfig, isTabAllowedForRole, getAccountsForRole } from '../utils/auth';

export default function Header({
  activeTab,
  setActiveTab,
  onOpenTeleconsult,
  backendOnline,
  camera,
  currentUser,
  activePatient,
  onSwitchAccount,
  onLogout
}) {
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const accountMenuRef = useRef(null);

  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const mobileMenuRef = useRef(null);

  // Close account menu and mobile menu on click outside or Escape
  useEffect(() => {
    function handleClickOutside(event) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target)) {
        setShowAccountMenu(false);
        setShowRoleSelector(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) {
        setShowMobileMenu(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setShowAccountMenu(false);
        setShowRoleSelector(false);
        setShowMobileMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const currentRoleId = currentUser?.roleId || (currentUser?.role?.toLowerCase().includes('officer') ? 'officer' : currentUser?.role?.toLowerCase().includes('admin') ? 'admin' : 'screener');
  
  const roleConfig = getRoleConfig(currentRoleId);
  const roleAccounts = getAccountsForRole(currentRoleId);

  const allNavTabs = [
    { id: 'overview', label: 'Overview', icon: 'dashboard', fullTitle: 'Overview & Triage' },
    { id: 'survey', label: 'Questionnaire', icon: 'assignment', fullTitle: 'Clinical Questionnaire (WOMAC/KOOS)' },
    { id: 'gait', label: 'Gait', icon: 'directions_walk', fullTitle: 'Gait Biomechanics HUD' },
    { id: 'report', label: 'Report & X-Ray', icon: 'radiology', fullTitle: 'Multimodal Diagnostic Report & X-Ray Staging' },
    { id: 'cohort', label: 'Patients', icon: 'groups', fullTitle: currentRoleId === 'screener' ? 'Station Triage Queue' : currentRoleId === 'officer' ? 'Clinical Review Roster' : 'ABDM Audit Registry' },
    { id: 'hardware', label: 'Hardware', icon: 'router', fullTitle: 'ESP32 Hardware Fleet' },
  ];

  const navTabs = allNavTabs.filter((tab) => isTabAllowedForRole(currentRoleId, tab.id));

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-inverse-surface text-surface shadow-[0_2px_12px_rgba(0,0,0,0.18)]">
      <div className="h-header-height w-full px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2 border-b border-white/10">
        {/* Brand Identity & Main Menu Navigation Button */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Main Navigation Menu Button (Always Available) */}
          <div className="relative" ref={mobileMenuRef}>
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              aria-label="Toggle Application Menu"
              aria-expanded={showMobileMenu}
              type="button"
              className={`px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 font-semibold text-xs ${
                showMobileMenu
                  ? 'bg-primary text-white border-white/30 shadow-md ring-2 ring-primary/40'
                  : 'bg-white/10 hover:bg-white/20 text-surface-container-lowest border-white/15 hover:border-white/30 shadow-xs'
              }`}
              title="Click to open OrthoNex navigation menu"
            >
              <span className="material-symbols-outlined text-[18px]">
                {showMobileMenu ? 'close' : 'menu'}
              </span>
              <span className="tracking-wide">Menu</span>
            </button>

            {/* Quick Navigation Dropdown Modal */}
            {showMobileMenu && (
              <div className="absolute left-0 mt-2 w-72 p-2.5 rounded-2xl bg-[#0f172a] border border-white/20 shadow-2xl z-50 text-left text-xs backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2.5 py-2 border-b border-white/10 mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                    <span className="font-bold text-white text-[11px] uppercase tracking-wider">
                      {currentRoleId === 'screener' ? 'Screener Modules' : currentRoleId === 'officer' ? 'Doctor Clinical Desk' : 'System Admin Console'}
                    </span>
                  </div>
                  <span className="text-[9px] text-cyan-300 font-data-mono uppercase tracking-wider">
                    {roleConfig.dataScope.replace('_', ' ')}
                  </span>
                </div>
                <div className="space-y-1">
                  {navTabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveTab(tab.id);
                          setShowMobileMenu(false);
                        }}
                        className={`w-full px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all text-left ${
                          isActive
                            ? 'bg-cyan-600 text-white font-bold shadow-md ring-1 ring-cyan-400'
                            : 'text-slate-300 hover:text-white hover:bg-white/10'
                        }`}
                        type="button"
                      >
                        <span className={`material-symbols-outlined text-[20px] ${isActive ? 'text-white' : 'text-cyan-400'}`}>{tab.icon}</span>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold">{tab.label}</span>
                          <span className="text-[10px] text-slate-400 font-normal">{tab.fullTitle}</span>
                        </div>
                        {isActive && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white"></span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setActiveTab('overview')}
            type="button"
            className="flex items-center gap-2 sm:gap-2.5 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl transition-all hover:opacity-95 active:scale-[0.98] cursor-pointer"
            title="Return to OrthoNex Main Page"
          >
            <div className="w-8 h-8 rounded-xl bg-black/30 border border-white/15 p-1 flex items-center justify-center shadow-xs overflow-hidden shrink-0 group-hover:border-white/40 group-hover:scale-105 transition-all">
              <img src="/logo.png" alt="OrthoNex Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-headline-sm text-surface-container-lowest font-extrabold tracking-tight text-sm sm:text-base group-hover:text-cyan-200 transition-colors">
                  OrthoNex
                </span>
                <span
                  className="px-1.5 py-0.2 rounded bg-primary-container/70 text-on-primary font-data-mono text-[9px] uppercase font-semibold tracking-wide"
                  title="Indian Council of Medical Research · National Musculoskeletal Screening Initiative"
                >
                  ICMR
                </span>
              </div>
              <span className="font-label-sm text-surface-dim/70 text-[10px] font-normal hidden lg:inline group-hover:text-surface-dim transition-colors">
                AI Musculoskeletal Triage
              </span>
            </div>
          </button>
        </div>


        {/* Status Actions & Clinician Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Active Area / Region Tag */}
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-highest/20 text-surface border border-white/10"
            title={`Active Region: ${activePatient?.region || currentUser?.station || 'Assam, NER'}`}
          >
            <span className="material-symbols-outlined text-[14px] text-tertiary-fixed">location_on</span>
            <span className="font-label-sm text-[11px] text-surface-container-lowest font-medium whitespace-nowrap">
              {activePatient?.region?.split(',')[0] || currentUser?.station?.split(',')[0] || 'Assam'}
            </span>
          </div>

          {/* Live Camera Quick Trigger */}
          <button
            onClick={camera?.isWebcamActive ? camera.stopCamera : () => camera?.startCamera()}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-label-sm text-[11px] font-semibold transition-all active:scale-95 border ${
              camera?.isWebcamActive
                ? 'bg-emerald-600/30 text-emerald-300 border-emerald-400/40 hover:bg-emerald-600/40'
                : 'bg-white/5 text-surface-dim border-white/10 hover:bg-white/10 hover:text-white'
            }`}
            title={camera?.isWebcamActive ? 'Camera Ready (Click to stop)' : 'Optical Camera Offline (Click to connect)'}
            aria-label={camera?.isWebcamActive ? 'Camera Ready' : 'Camera'}
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">
              {camera?.isWebcamActive ? 'videocam' : 'videocam_off'}
            </span>
            <span className="hidden sm:inline">
              {camera?.isWebcamActive ? 'Camera Ready' : 'Camera'}
            </span>
          </button>

          {/* Teleconsult Floater Quick Trigger */}
          <button
            onClick={onOpenTeleconsult}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-tertiary-container/30 hover:bg-tertiary-container/50 text-tertiary-fixed font-label-sm text-[11px] font-semibold border border-tertiary/30 transition-all active:scale-95"
            title="Open Teleconsult & Referral Desk"
            aria-label="Open Teleconsult & Referral Desk"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">medical_services</span>
            <span className="hidden sm:inline">Consult</span>
          </button>

          {/* Clinician Profile & Accounts Menu Trigger */}
          <div className="relative flex items-center border-l border-white/10 pl-1.5 sm:pl-2" ref={accountMenuRef}>
            <button
              onClick={() => {
                setShowAccountMenu(!showAccountMenu);
                setShowRoleSelector(false);
              }}
              aria-label="Clinician account settings and profile menu"
              aria-expanded={showAccountMenu}
              aria-haspopup="true"
              type="button"
              className="flex items-center gap-1.5 sm:gap-2 p-1 rounded-xl hover:bg-white/5 transition-all text-left group focus:outline-none focus:ring-1 focus:ring-primary-fixed"
            >
              <div className="text-right hidden lg:block max-w-[120px] xl:max-w-[160px]">
                <p className="font-label-md text-[11px] text-surface-container-lowest font-semibold leading-tight flex items-center justify-end gap-1 truncate">
                  <span className="truncate">{currentUser?.name || 'Dr. R. Sharma, MO'}</span>
                  {currentUser?.isDemo && (
                    <span className="px-1 py-0.2 rounded bg-tertiary-container/40 text-tertiary-fixed font-data-mono text-[9px] font-bold shrink-0">
                      Simulated
                    </span>
                  )}
                </p>
                <p className="font-label-sm text-[10px] text-surface-dim truncate">
                  {currentUser?.role || 'Clinical Screener'}
                </p>
              </div>

              <div
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-sm ring-1 ring-white/20 group-hover:ring-white/40 transition-all"
                title={`${currentUser?.name || 'Dr. R. Sharma'} (${currentUser?.role || 'Clinical Screener'})`}
              >
                <span className="material-symbols-outlined text-on-primary text-[16px] sm:text-[18px]">
                  person
                </span>
              </div>

              <span className="material-symbols-outlined text-[14px] text-surface-dim hidden sm:inline transition-transform duration-200">
                {showAccountMenu ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {/* Accessible Accounts Menu Dropdown */}
            {showAccountMenu && (
              <div
                role="menu"
                aria-label="User Account Menu"
                className="absolute right-0 top-full mt-2 w-72 sm:w-80 p-3 rounded-2xl bg-inverse-surface border border-white/15 shadow-2xl z-50 text-left backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
              >
                {/* Header: Current Active Account Overview */}
                <div className="pb-3 border-b border-white/10 mb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-white text-sm truncate">
                          {currentUser?.name || 'Staff User'}
                        </span>
                        {currentUser?.isDemo && (
                          <span
                            className="px-1.5 py-0.5 rounded bg-tertiary-container/40 text-tertiary-fixed font-data-mono text-[9px] font-bold uppercase tracking-wider"
                            title="Offline Simulation Mode"
                          >
                            {currentUser?.demoStatus || 'Demo'}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-surface-dim truncate mt-0.5 font-data-mono">
                        {currentUser?.email || 'screener@phc.assam.gov.in'}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-primary/40 text-primary-fixed text-[10px] font-semibold shrink-0">
                      {currentUser?.role || 'Clinical Screener'}
                    </span>
                  </div>

                  {/* Metadata Chips: Staff ID & Station */}
                  <div className="mt-2.5 pt-2 border-t border-white/5 grid grid-cols-2 gap-2 text-[10px] text-surface-dim">
                    <div className="bg-black/30 p-1.5 rounded-lg border border-white/5">
                      <span className="block text-white/50 font-data-mono uppercase text-[8px]">Staff / Node ID</span>
                      <span className="font-data-mono text-white font-medium truncate block">
                        {currentUser?.id || 'NER-STAFF-0892'}
                      </span>
                    </div>
                    <div className="bg-black/30 p-1.5 rounded-lg border border-white/5">
                      <span className="block text-white/50 font-data-mono uppercase text-[8px]">Current Station</span>
                      <span className="text-white font-medium truncate block">
                        {currentUser?.station || 'Diphu PHC'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section: Switch Account within Current Role */}
                <div className="mb-3">
                  <div className="flex items-center justify-between pb-1.5">
                    <span className="text-[11px] font-semibold text-white/90">
                      Switch Account ({currentUser?.role || 'Clinical Screener'})
                    </span>
                    <button
                      onClick={() => setShowRoleSelector(!showRoleSelector)}
                      type="button"
                      className="text-[10px] text-tertiary-fixed hover:underline"
                    >
                      {showRoleSelector ? 'Cancel' : 'Change Role'}
                    </button>
                  </div>

                  {/* Intra-role account list */}
                  {!showRoleSelector ? (
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
                      {roleAccounts.map((acc) => {
                        const isCurrent = acc.email === currentUser?.email || acc.staffId === currentUser?.staffId || acc.staffId === currentUser?.id || acc.id === currentUser?.id;
                        return (
                          <button
                            key={acc.id || acc.email}
                            type="button"
                            role="menuitem"
                            disabled={isCurrent}
                            onClick={() => {
                              if (onSwitchAccount) {
                                onSwitchAccount(acc);
                              }
                              setShowAccountMenu(false);
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-all ${
                              isCurrent
                                ? 'bg-primary-container/30 border border-primary/40 text-white cursor-default'
                                : 'hover:bg-white/10 text-surface-dim hover:text-white border border-transparent'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <p className="font-medium text-[11px] truncate text-white">
                                {acc.name}
                              </p>
                              <p className="text-[10px] text-surface-dim/80 truncate">
                                {acc.station}
                              </p>
                            </div>
                            {isCurrent ? (
                              <span className="material-symbols-outlined text-[16px] text-tertiary-fixed shrink-0">
                                check_circle
                              </span>
                            ) : (
                              <span className="text-[10px] text-tertiary-fixed font-data-mono shrink-0">
                                Switch
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    /* Optional Role Selector to switch role explicitly */
                    <div className="p-2 rounded-xl bg-black/40 border border-white/10 space-y-1.5">
                      <p className="text-[10px] text-surface-dim">Select new clinical discipline:</p>
                      {Object.values(ROLES).map((role) => (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => {
                            const accounts = getAccountsForRole(role.id);
                            if (accounts.length > 0 && onSwitchAccount) {
                              onSwitchAccount(accounts[0]);
                            }
                            setShowRoleSelector(false);
                            setShowAccountMenu(false);
                          }}
                          className={`w-full flex items-center justify-between p-1.5 rounded-lg text-xs text-left ${
                            currentRoleId === role.id ? 'bg-white/10 text-tertiary-fixed font-semibold' : 'text-surface-dim hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <span>{role.label}</span>
                          <span className="text-[10px] font-data-mono text-white/50">
                            {getAccountsForRole(role.id).length} accounts
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Actions: Sign Out */}
                <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setShowAccountMenu(false);
                      if (onLogout) onLogout();
                    }}
                    type="button"
                    role="menuitem"
                    className="w-full py-1.5 px-3 rounded-xl bg-error/15 hover:bg-error/25 text-error-container hover:text-white border border-error/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[16px]">logout</span>
                    Sign out of station
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </header>
  );
}

