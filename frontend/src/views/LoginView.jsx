import React, { useState, useEffect } from 'react';
import { ROLES, DEMO_ACCOUNTS, loginAsDemo, loginWithPassword, signupUser, loginWithGoogle, formatSupabaseUser, getSession } from '../utils/auth';

export default function LoginView({ onLogin }) {
  // Splash introduction animation state
  const [showSplash, setShowSplash] = useState(true);
  const [splashProgress, setSplashProgress] = useState(0);

  // Authentication Mode: 'login' | 'register'
  const [authMode, setAuthMode] = useState('login');

  // Sign In State (Default to Medical Officer for full Expo access to Reports & X-Rays)
  const [selectedRole, setSelectedRole] = useState('officer');
  const [identifier, setIdentifier] = useState('mo.sharma@gmch.gov.in');
  const [password, setPassword] = useState('demo123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);

  // Registration State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regStaffId, setRegStaffId] = useState('');
  const [regStation, setRegStation] = useState('CHC Station / PHC Hub');
  const [regRole, setRegRole] = useState('screener');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regSuccessMessage, setRegSuccessMessage] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Splash Screen Intro Animation sequence (lasts ~2.6s)
  useEffect(() => {
    const timer = setInterval(() => {
      setSplashProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(() => setShowSplash(false), 300);
          return 100;
        }
        return prev + 5;
      });
    }, 110);

    return () => clearInterval(timer);
  }, []);

  // Switch role and update default demo credential suggestion
  const handleRoleSelect = (roleId) => {
    setSelectedRole(roleId);
    setErrorMessage('');
    const demo = DEMO_ACCOUNTS.find((d) => d.role === roleId);
    if (demo) {
      setIdentifier(demo.email);
      setPassword(demo.password);
    }
  };

  // Quick fill active demo credentials
  const handleQuickFill = () => {
    const demo = DEMO_ACCOUNTS.find((d) => d.role === selectedRole);
    if (demo) {
      setIdentifier(demo.email);
      setPassword(demo.password);
      setErrorMessage('');
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!identifier.trim()) {
      setErrorMessage('Please enter your Staff ID or registered PHC email address.');
      return;
    }

    if (!password.trim()) {
      setErrorMessage('Please enter your station access password.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Check if user is logging in with preset frontline demo credentials
      const matchingDemo = DEMO_ACCOUNTS.find(
        (acc) =>
          acc.email.toLowerCase() === identifier.trim().toLowerCase() &&
          acc.password === password
      );

      if (matchingDemo) {
        const demoUser = loginAsDemo(matchingDemo.role);
        // Persist session so it survives reloads
        sessionStorage.setItem('oa_ner_auth_session', JSON.stringify(demoUser));
        setIsSubmitting(false);
        onLogin(demoUser);
        return;
      }

      // 2. Real Supabase Authentication for registered users
      const { user } = await loginWithPassword({
        email: identifier.trim(),
        password: password
      });

      if (user) {
        const formatted = formatSupabaseUser(user);
        setIsSubmitting(false);
        onLogin(formatted);
      } else {
        throw new Error('Could not retrieve user profile.');
      }
    } catch (err) {
      setIsSubmitting(false);
      setErrorMessage(err.message || 'Authentication failed. Please verify email and password.');
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (regPassword !== regConfirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await signupUser({
        email: regEmail,
        password: regPassword,
        name: regName,
        roleId: regRole,
        station: regStation
      });
      setRegSuccessMessage('Account created successfully! You can now log in.');
      setTimeout(() => {
        setAuthMode('login');
        setRegSuccessMessage('');
        setIdentifier(regEmail);
        setPassword('');
      }, 3000);
    } catch (err) {
      setErrorMessage(err.message || 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [googleAuthConfigured, setGoogleAuthConfigured] = useState(false);
  const [googleNotice, setGoogleNotice] = useState('');

  const API_BASE =
    import.meta.env.VITE_API_BASE_URL ||
    (typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
      ? 'https://oa-ner-screening.onrender.com'
      : 'http://localhost:8000');

  // Check if backend has Google credentials configured
  React.useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/auth/status`, {
      headers: { Accept: 'application/json' },
    })
      .then((res) => res.json())
      .then((data) => {
        if (active && data) {
          setGoogleAuthConfigured(Boolean(data.google_configured));
        }
      })
      .catch(() => {
        // backend offline / edge mode
      });
    return () => {
      active = false;
    };
  }, []);

  const handleDemoBypass = () => {
    const user = loginAsDemo(selectedRole);
    onLogin(user);
  };

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (err) {
      setErrorMessage(err.message || 'Google Login failed');
    }
  };

  const currentRoleConfig = ROLES[selectedRole] || ROLES.screener;

  // 1. Initial Animated Splash Screen
  if (showSplash) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] flex flex-col items-center justify-center p-md relative overflow-hidden select-none">
        {/* Background Aura Rings */}
        <div className="absolute w-[500px] h-[500px] rounded-full bg-primary/10 blur-3xl animate-pulse pointer-events-none"></div>
        <div className="absolute w-[400px] h-[400px] rounded-full bg-tertiary/10 blur-2xl animate-pulse pointer-events-none" style={{ animationDelay: '1s' }}></div>

        {/* Center Animated Logo & Biomechanical Hologram */}
        <div className="relative z-10 flex flex-col items-center text-center max-w-md w-full">
          <div className="relative w-24 h-24 mb-md">
            {/* Animated Rotating Radar Ring */}
            <div className="absolute inset-0 rounded-3xl border-2 border-primary/30 animate-spin" style={{ animationDuration: '6s' }}></div>
            <div className="absolute inset-1.5 rounded-2xl border-2 border-dashed border-tertiary/40 animate-spin" style={{ animationDuration: '9s', animationDirection: 'reverse' }}></div>
            
            {/* Logo Center */}
            <div className="w-full h-full rounded-2xl bg-surface-container-lowest shadow-xl border border-surface-container flex items-center justify-center p-3">
              <img
                src="/logo.png"
                alt="OrthoNex Logo"
                className="w-full h-full object-contain animate-pulse"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-headline-lg text-3xl font-extrabold text-on-surface tracking-tight">
              OrthoNex
            </h1>
            <span className="px-2 py-0.5 rounded bg-primary text-on-primary font-data-mono text-[10px] font-bold uppercase tracking-wider">
              AI Triage
            </span>
          </div>
          <p className="font-label-sm text-xs text-on-surface-variant font-medium mb-lg">
            ICMR National Musculoskeletal Tele-Screening & ABDM Initiative
          </p>

          {/* Loading Progress Bar */}
          <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden mb-2 border border-surface-container shadow-inner">
            <div
              className="bg-primary h-full rounded-full transition-all duration-150 ease-out"
              style={{ width: `${splashProgress}%` }}
            ></div>
          </div>

          <div className="flex items-center justify-between w-full font-data-mono text-[11px] text-secondary">
            <span>Initializing Neural Modules...</span>
            <span className="font-bold text-primary">{splashProgress}%</span>
          </div>

          {/* Skip Intro button */}
          <button
            onClick={() => setShowSplash(false)}
            className="mt-lg px-md py-1 rounded-full text-[11px] text-secondary hover:text-on-surface hover:bg-surface-container transition flex items-center gap-1"
            type="button"
          >
            <span>Skip Intro</span>
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. Main Login View with the exact original light/clinical theme colors
  return (
    <div className="min-h-screen bg-background font-body-md text-on-surface flex flex-col justify-between selection:bg-primary-fixed selection:text-on-primary-fixed animate-fade-in">
      {/* Top Clinical Agency Bar */}
      <header className="w-full bg-inverse-surface text-surface py-2 px-lg border-b border-white/10 flex items-center justify-between text-xs">
        <div className="flex items-center gap-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-data-mono text-tertiary-fixed font-semibold uppercase tracking-wider">
            OrthoNex India · National Tele-Triage Network
          </span>
          <span className="text-white/20 hidden sm:inline">|</span>
          <span className="text-surface-dim hidden sm:inline">ABDM National Hub</span>
        </div>
        <div className="flex items-center gap-sm">
          <span className="font-label-sm text-[11px] text-surface-dim flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px] text-tertiary">location_on</span>
            National Clinical Registry
          </span>
          <span className="px-1.5 py-0.5 rounded bg-white/10 font-data-mono text-[10px] text-tertiary-fixed">
            Edge Ready
          </span>
        </div>
      </header>

      {/* Main Two-Column Portal Container */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-md sm:px-lg py-lg lg:py-2xl flex items-center justify-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-xl lg:gap-2xl items-stretch">
          
          {/* LEFT COLUMN: Focused Clinical Login Terminal */}
          <section
            aria-label="Clinical Sign In Form"
            className="lg:col-span-5 xl:col-span-5 flex flex-col justify-center"
          >
            <div className="w-full bg-surface-container-lowest rounded-2xl shadow-xl border border-surface-container p-lg sm:p-xl">
              
              {/* Primary Tab Switcher */}
              <div className="flex rounded-xl bg-surface-container-low p-1 border border-surface-container mb-md">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setErrorMessage('');
                    setRegSuccessMessage('');
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold font-label-md transition flex items-center justify-center gap-1.5 ${
                    authMode === 'login'
                      ? 'bg-surface-container-lowest text-primary shadow-sm'
                      : 'text-secondary hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">login</span>
                  <span>Station Sign In</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setErrorMessage('');
                    setRegSuccessMessage('');
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold font-label-md transition flex items-center justify-center gap-1.5 ${
                    authMode === 'register'
                      ? 'bg-surface-container-lowest text-primary shadow-sm'
                      : 'text-secondary hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">person_add</span>
                  <span>Register Practitioner</span>
                </button>
              </div>

              {/* Form Header */}
              <div className="mb-md pb-sm border-b border-surface-container">
                <div className="flex items-center justify-between gap-xs mb-1">
                  <span className="font-headline-sm text-lg font-bold text-on-surface">
                    {authMode === 'register' ? 'Enroll Station Practitioner' : 'Station Terminal Sign In'}
                  </span>
                  <span className="px-xs py-0.5 rounded bg-surface-container-high text-primary font-data-mono text-[10px] font-bold uppercase">
                    NER-SOP-09
                  </span>
                </div>
                <p className="font-body-sm text-secondary text-xs">
                  {authMode === 'register'
                    ? 'Create an institutional account for frontline health screeners, Medical Officers, or IT administrators.'
                    : 'Authorize your PHC screening session to access patient triage, gait camera feeds, and diagnostic reports.'}
                </p>
              </div>

              {/* Error Notification Alert */}
              {errorMessage && (
                <div
                  role="alert"
                  className="mb-md p-sm rounded-xl bg-error-container/30 border border-error/50 text-on-surface flex items-start gap-xs animate-fade-in"
                >
                  <span className="material-symbols-outlined text-error text-[20px] shrink-0 mt-0.5">
                    error
                  </span>
                  <div className="flex-1">
                    <span className="font-label-md text-xs font-bold text-error block">
                      Authentication Alert
                    </span>
                    <p className="font-body-sm text-xs text-on-surface mt-0.5">
                      {errorMessage}
                    </p>
                  </div>
                </div>
              )}

              {/* Success Notification Alert */}
              {regSuccessMessage && (
                <div
                  role="status"
                  className="mb-md p-sm rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-on-surface flex items-start gap-xs animate-fade-in"
                >
                  <span className="material-symbols-outlined text-emerald-600 text-[20px] shrink-0 mt-0.5">
                    check_circle
                  </span>
                  <div className="flex-1">
                    <span className="font-label-md text-xs font-bold text-emerald-700 dark:text-emerald-300 block">
                      Registration Complete
                    </span>
                    <p className="font-body-sm text-xs text-on-surface mt-0.5">
                      {regSuccessMessage}
                    </p>
                  </div>
                </div>
              )}

              {/* MODE 1: PRACTITIONER REGISTRATION FORM */}
              {authMode === 'register' ? (
                <form onSubmit={handleRegisterSubmit} noValidate className="space-y-sm animate-fade-in">
                  <div>
                    <label className="block font-label-sm text-[11px] text-on-surface-variant font-bold uppercase tracking-wider mb-1">
                      Full Name & Designation *
                    </label>
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="e.g., Dr. R. Khurana, Delhi OPD / S. Sharma, Noida"
                      className="w-full bg-surface-container-low text-on-surface placeholder:text-outline text-xs rounded-xl px-3 py-2 border border-surface-container focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
                    <div>
                      <label className="block font-label-sm text-[11px] text-on-surface-variant font-bold uppercase tracking-wider mb-1">
                        Assigned Operational Role *
                      </label>
                      <select
                        value={regRole}
                        onChange={(e) => setRegRole(e.target.value)}
                        className="w-full bg-surface-container-low text-on-surface text-xs rounded-xl px-3 py-2 border border-surface-container focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition"
                      >
                        <option value="screener">Clinical Screener (ANM / GNM)</option>
                        <option value="officer">Medical Officer (MO / Ortho)</option>
                        <option value="admin">System Administrator (IT / Mesh)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-label-sm text-[11px] text-on-surface-variant font-bold uppercase tracking-wider mb-1">
                        Staff / Registration ID
                      </label>
                      <input
                        type="text"
                        value={regStaffId}
                        onChange={(e) => setRegStaffId(e.target.value)}
                        placeholder="e.g., DEL-MO-0101 / NOI-STAFF-2045 (or auto)"
                        className="w-full bg-surface-container-low text-on-surface placeholder:text-outline text-xs rounded-xl px-3 py-2 border border-surface-container focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition font-data-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-label-sm text-[11px] text-on-surface-variant font-bold uppercase tracking-wider mb-1">
                      Hospital / Station Facility Location
                    </label>
                    <input
                      type="text"
                      value={regStation}
                      onChange={(e) => setRegStation(e.target.value)}
                      placeholder="e.g., Safdarjung Hospital Delhi / Dist. Hospital Sec 39 Noida / GMCH"
                      className="w-full bg-surface-container-low text-on-surface placeholder:text-outline text-xs rounded-xl px-3 py-2 border border-surface-container focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition"
                    />
                  </div>

                  <div>
                    <label className="block font-label-sm text-[11px] text-on-surface-variant font-bold uppercase tracking-wider mb-1">
                      Institutional / Official Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="e.g., dr.baruah@gmch.gov.in"
                      className="w-full bg-surface-container-low text-on-surface placeholder:text-outline text-xs rounded-xl px-3 py-2 border border-surface-container focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
                    <div>
                      <label className="block font-label-sm text-[11px] text-on-surface-variant font-bold uppercase tracking-wider mb-1">
                        Access Password *
                      </label>
                      <input
                        type="password"
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Min. 5 chars"
                        className="w-full bg-surface-container-low text-on-surface placeholder:text-outline text-xs rounded-xl px-3 py-2 border border-surface-container focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition"
                      />
                    </div>
                    <div>
                      <label className="block font-label-sm text-[11px] text-on-surface-variant font-bold uppercase tracking-wider mb-1">
                        Confirm Password *
                      </label>
                      <input
                        type="password"
                        required
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        placeholder="Repeat password"
                        className="w-full bg-surface-container-low text-on-surface placeholder:text-outline text-xs rounded-xl px-3 py-2 border border-surface-container focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={`w-full py-2.5 px-md rounded-xl font-label-md text-sm font-bold text-on-primary bg-primary hover:bg-primary-container shadow-md transition-all flex items-center justify-center gap-2 ${
                        isSubmitting ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'
                      }`}
                    >
                      {isSubmitting ? (
                        <>
                          <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
                          <span>Enrolling Practitioner...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
                          <span>Enroll Practitioner & Enter Station</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setAuthMode('login')}
                      className="w-full mt-2 py-1.5 text-xs text-secondary hover:text-on-surface text-center block transition"
                    >
                      Already registered? <span className="text-primary font-semibold underline">Sign In</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* MODE 2: SIGN IN FORM */
                <form onSubmit={handleFormSubmit} noValidate className="space-y-md">
                  {/* 1. Accessible Role Segmented Selector */}
                  <div>
                    <label className="block font-label-sm text-[11px] text-on-surface-variant font-bold uppercase tracking-wider mb-1.5">
                      Select Operational Role
                    </label>
                    <div
                      role="radiogroup"
                      aria-label="Select Station Role"
                      className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-surface-container-low border border-surface-container"
                    >
                      {Object.values(ROLES).map((role) => {
                        const isSelected = selectedRole === role.id;
                        return (
                          <button
                            key={role.id}
                            role="radio"
                            aria-checked={isSelected}
                            onClick={() => handleRoleSelect(role.id)}
                            className={`flex flex-col items-center justify-center p-2 rounded-lg text-center transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-primary text-on-primary shadow-sm font-semibold'
                                : 'text-secondary hover:text-on-surface hover:bg-white/60'
                            }`}
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[18px] mb-0.5">{role.icon}</span>
                            <span className="font-label-sm text-[11px] leading-tight block">
                              {role.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="font-body-sm text-[11px] text-secondary mt-1.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-primary">info</span>
                      <span>{currentRoleConfig.description}</span>
                    </p>
                  </div>

                  {/* Staff ID or Email Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor="identifier-input"
                        className="font-label-sm text-xs font-bold text-on-surface uppercase tracking-wide"
                      >
                        Staff ID or Registered Email *
                      </label>
                      <span className="text-[10px] text-secondary font-data-mono">
                        e.g., {currentRoleConfig.defaultEmail}
                      </span>
                    </div>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-3 text-secondary text-[18px] pointer-events-none">
                        badge
                      </span>
                      <input
                        id="identifier-input"
                        type="text"
                        required
                        autoComplete="username"
                        value={identifier}
                        onChange={(e) => {
                          setIdentifier(e.target.value);
                          if (errorMessage) setErrorMessage('');
                        }}
                        placeholder="e.g., screener@phc.assam.gov.in"
                        className="w-full bg-surface-container-low text-on-surface placeholder:text-outline text-xs rounded-xl pl-10 pr-3 py-2.5 border border-surface-container focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition"
                      />
                    </div>
                  </div>

                  {/* Password Input with Show/Hide Toggle */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor="password-input"
                        className="font-label-sm text-xs font-bold text-on-surface uppercase tracking-wide"
                      >
                        Station Access Password *
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowForgotModal(true)}
                        className="font-label-sm text-[11px] text-primary hover:underline"
                      >
                        Forgot access?
                      </button>
                    </div>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-3 text-secondary text-[18px] pointer-events-none">
                        lock
                      </span>
                      <input
                        id="password-input"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (errorMessage) setErrorMessage('');
                        }}
                        placeholder="Enter station password"
                        className="w-full bg-surface-container-low text-on-surface placeholder:text-outline text-xs rounded-xl pl-10 pr-10 py-2.5 border border-surface-container focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3 text-secondary hover:text-on-surface transition p-1"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {showPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Remember Device Checkbox & Quickfill helper */}
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberDevice}
                        onChange={(e) => setRememberDevice(e.target.checked)}
                        className="w-4 h-4 accent-primary rounded cursor-pointer"
                      />
                      <span className="font-label-sm text-xs text-secondary">
                        Remember this station terminal
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={handleQuickFill}
                      className="font-label-sm text-[11px] text-tertiary hover:text-tertiary-container font-semibold underline flex items-center gap-0.5"
                      title="Populate recommended demo credentials for selected role"
                    >
                      <span className="material-symbols-outlined text-[13px]">magic_button</span>
                      Fill Demo Key
                    </button>
                  </div>

                  {/* Submit Action Button */}
                  <div className="pt-xs space-y-xs">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={`w-full py-2.5 px-md rounded-xl font-label-md text-sm font-bold text-on-primary bg-primary hover:bg-primary-container shadow-md transition-all flex items-center justify-center gap-2 ${
                        isSubmitting ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'
                      }`}
                    >
                      {isSubmitting ? (
                        <>
                          <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
                          <span>Verifying Station Credentials...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[18px]">login</span>
                          <span>Sign In to Screening Station</span>
                        </>
                      )}
                    </button>

                    {/* Google Authentication Flow temporarily hidden */}
                    {/*
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={handleGoogleLogin}
                        className="w-full py-2.5 px-md rounded-xl font-label-md text-xs font-semibold text-on-surface bg-surface-container-lowest hover:bg-surface-container border border-outline-variant/60 shadow-xs transition-all flex items-center justify-center gap-2.5 active:scale-95"
                      >
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                        <span>Continue with Google</span>
                      </button>

                      {googleNotice && (
                        <div className="mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-[11px] flex items-start gap-1.5">
                          <span className="material-symbols-outlined text-[15px] text-amber-600 shrink-0 mt-0.5">info</span>
                          <span>{googleNotice}</span>
                        </div>
                      )}
                    </div>
                    */}

                    {/* 1-Click Local Demo Mode Action */}
                    <div className="pt-2">
                      <div className="relative flex items-center justify-center my-2">
                        <div className="border-t border-surface-container w-full"></div>
                        <span className="bg-surface-container-lowest px-2 font-label-sm text-[10px] uppercase text-secondary font-bold tracking-wider absolute">
                          Quick Frontline Evaluation
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={handleDemoBypass}
                        className="w-full py-2 px-md rounded-xl font-label-md text-xs font-semibold text-on-surface bg-surface-container-low hover:bg-surface-container border border-outline-variant/40 shadow-xs transition-all flex items-center justify-center gap-2 active:scale-95"
                      >
                        <span className="material-symbols-outlined text-[16px] text-tertiary">bolt</span>
                        <span>Launch OrthoNex Demo</span>
                        <span className="px-1.5 py-0.5 rounded bg-tertiary-container/30 text-tertiary font-data-mono text-[9px] font-bold">
                          Offline Simulation
                        </span>
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Demo Credentials Cheat-Sheet Card */}
              <div className="mt-md p-3 rounded-xl bg-surface-container-low/80 border border-surface-container text-[11px] text-secondary space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-on-surface flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-primary">badge</span>
                    <span>National Trial & Hospital Credentials:</span>
                  </span>
                  <span className="text-[10px] font-data-mono text-tertiary font-semibold">Password: demo123</span>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">
                    Medical Officers & Orthopedic Consultants:
                  </div>
                  <div className="grid grid-cols-1 gap-1">
                    {DEMO_ACCOUNTS.filter(a => a.role === 'officer').slice(0, 3).map((acc) => (
                      <button
                        key={acc.email}
                        type="button"
                        onClick={() => {
                          setSelectedRole('officer');
                          setIdentifier(acc.email);
                          setPassword(acc.password);
                          setErrorMessage('');
                        }}
                        className="w-full text-left p-1.5 px-2 rounded-lg bg-surface-container-lowest hover:bg-surface-container border border-surface-container flex items-center justify-between text-[11px] transition active:scale-[0.99]"
                        title="Click to fill credentials"
                      >
                        <div className="truncate">
                          <span className="font-bold text-primary font-data-mono">{acc.name}</span>
                          <span className="text-secondary block text-[10px] truncate">{acc.station}</span>
                        </div>
                        <span className="text-[10px] font-data-mono text-secondary ml-2 shrink-0">{acc.email}</span>
                      </button>
                    ))}
                  </div>

                  <div className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider pt-1">
                    Frontline Clinical Screeners & Admins:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {DEMO_ACCOUNTS.filter(a => a.role !== 'officer').slice(0, 4).map((acc) => (
                      <button
                        key={acc.email}
                        type="button"
                        onClick={() => {
                          setSelectedRole(acc.role);
                          setIdentifier(acc.email);
                          setPassword(acc.password);
                          setErrorMessage('');
                        }}
                        className="text-left p-1.5 px-2 rounded-lg bg-surface-container-lowest hover:bg-surface-container border border-surface-container text-[11px] transition active:scale-[0.99] truncate"
                        title="Click to fill credentials"
                      >
                        <div className="font-bold text-on-surface truncate text-[10px]">{acc.name}</div>
                        <div className="text-secondary text-[9px] font-data-mono truncate">{acc.email}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT COLUMN: Branded Operational Clinical Showcase & Site Explanation */}
          <section
            aria-label="OrthoNex Clinical Overview"
            className="lg:col-span-7 xl:col-span-7 flex flex-col justify-between p-lg sm:p-xl rounded-2xl bg-surface-container-low border border-surface-container shadow-sm"
          >
            <div>
              {/* Institution & App Header */}
              <div className="flex items-center gap-md mb-md">
                <div className="w-14 h-14 rounded-2xl bg-inverse-surface border border-white/15 p-1.5 shadow-md flex items-center justify-center shrink-0">
                  <img
                    src="/logo.png"
                    alt="OrthoNex Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-xs flex-wrap">
                    <h1 className="font-headline-lg text-[26px] sm:text-[30px] text-on-surface font-extrabold tracking-tight">
                      OrthoNex
                    </h1>
                    <span className="px-xs py-2xs rounded bg-primary text-on-primary font-data-mono text-[10px] uppercase font-bold tracking-wider">
                      ICMR National Protocol
                    </span>
                  </div>
                  <p className="font-label-sm text-body-sm text-secondary font-medium">
                    Multimodal AI Musculoskeletal Screening & Tele-Triage
                  </p>
                </div>
              </div>

              {/* Station Deployment Badge */}
              <div className="inline-flex items-center gap-xs px-sm py-1.5 rounded-full bg-surface-container text-on-surface font-label-sm text-[12px] font-semibold mb-lg border border-outline-variant/30">
                <span className="material-symbols-outlined text-[16px] text-primary">local_hospital</span>
                <span>Frontline Field Station: Primary Healthcare & District Clinics (Pan-India)</span>
              </div>

              {/* Core Operational Capabilities Matrix */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm mb-lg">
                <div className="p-md rounded-xl bg-surface-container-lowest border border-surface-container flex flex-col justify-between">
                  <div className="flex items-center gap-xs mb-1">
                    <span className="material-symbols-outlined text-primary text-[20px]">directions_walk</span>
                    <h3 className="font-headline-sm text-sm font-bold text-on-surface">
                      Gait Biomechanics HUD
                    </h3>
                  </div>
                  <p className="font-body-sm text-secondary text-xs leading-relaxed">
                    High-precision 33-point sagittal skeleton capture at 30 FPS. Measures antalgic lag and knee ROM asymmetry in 8-second walking trials.
                  </p>
                </div>

                <div className="p-md rounded-xl bg-surface-container-lowest border border-surface-container flex flex-col justify-between">
                  <div className="flex items-center gap-xs mb-1">
                    <span className="material-symbols-outlined text-tertiary text-[20px]">checklist</span>
                    <h3 className="font-headline-sm text-sm font-bold text-on-surface">
                      KOOS-India Symptom Survey
                    </h3>
                  </div>
                  <p className="font-body-sm text-secondary text-xs leading-relaxed">
                    Visual Analog Scales (VAS) & pan-India physical load matrix available in 7 major Indian languages.
                  </p>
                </div>

                <div className="p-md rounded-xl bg-surface-container-lowest border border-surface-container flex flex-col justify-between">
                  <div className="flex items-center gap-xs mb-1">
                    <span className="material-symbols-outlined text-error text-[20px]">radiology</span>
                    <h3 className="font-headline-sm text-sm font-bold text-on-surface">
                      X-Ray & Grad-CAM Heatmap
                    </h3>
                  </div>
                  <p className="font-body-sm text-secondary text-xs leading-relaxed">
                    Kellgren-Lawrence (KL Grade 0-4) classification with joint space Grad-CAM attention heatmap verification.
                  </p>
                </div>

                <div className="p-md rounded-xl bg-surface-container-lowest border border-surface-container flex flex-col justify-between">
                  <div className="flex items-center gap-xs mb-1">
                    <span className="material-symbols-outlined text-primary text-[20px]">cell_tower</span>
                    <h3 className="font-headline-sm text-sm font-bold text-on-surface">
                      National Specialist Mesh
                    </h3>
                  </div>
                  <p className="font-body-sm text-secondary text-xs leading-relaxed">
                    Instant 1-click clinical dossier transfer to orthopedic specialist faculties at AIIMS New Delhi, PGIMER Chandigarh, CMC Vellore, KEM Mumbai, and GMCH Guwahati.
                  </p>
                </div>
              </div>
            </div>
          </section>


        </div>
      </main>

      {/* Institutional Clinical Footer */}
      <footer className="w-full bg-surface-container-lowest shadow-[0_-1px_4px_rgba(0,0,0,0.03)] border-t border-surface-container py-sm mt-auto">
        <div className="max-w-[1400px] mx-auto px-lg flex flex-wrap items-center justify-between gap-sm text-secondary font-body-sm text-[11px]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-on-surface">OrthoNex AI Musculoskeletal Platform</span>
            <span>·</span>
            <span>ICMR-RMRC North East Joint Tele-Screening Initiative</span>
          </div>
          <div className="flex items-center gap-md">
            <span className="italic text-secondary font-normal">
              Research prototype — not for standalone diagnosis
            </span>
            <span className="text-outline-variant">|</span>
            <span className="font-data-mono font-medium text-on-surface">v3.4.2-clinical-lts</span>
          </div>
        </div>
      </footer>

      {/* Forgot Password / Station Help Modal */}
      {showForgotModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-md bg-black/60 backdrop-blur-sm animate-fade-in"
        >
          <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/30 overflow-hidden">
            <div className="px-lg py-md bg-inverse-surface text-surface flex items-center justify-between">
              <div className="flex items-center gap-xs">
                <span className="material-symbols-outlined text-[20px] text-primary-fixed">help</span>
                <h3 className="font-headline-sm text-sm font-bold text-surface">
                  Station Access Recovery SOP
                </h3>
              </div>
              <button
                onClick={() => setShowForgotModal(false)}
                className="p-1 rounded-lg text-surface-dim hover:text-white hover:bg-white/10 transition"
                type="button"
                aria-label="Close recovery dialog"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-lg space-y-sm text-xs text-secondary">
              <p className="text-on-surface font-medium">
                Under the <strong>ICMR-NER-SOP-09</strong> clinical protocol, station passwords cannot be reset over public unencrypted SMS or email.
              </p>
              <div className="p-sm rounded-lg bg-surface-container border border-surface-container-high space-y-1">
                <div className="font-semibold text-on-surface">Station IT Desk (Karbi Anglong Hub):</div>
                <div className="font-data-mono text-[11px]">Phone / Intercom: Ext. 204 (03671-272210)</div>
                <div className="font-data-mono text-[11px]">Station Admin: admin.diphu@icmr.gov.in</div>
                <div className="text-[10px] text-secondary">Hours: 08:00 - 18:00 IST (Mon-Sat)</div>
              </div>
              <p className="text-[11px]">
                For instant trial and testing on this device, you can use the default credential <strong>demo123</strong> or click <strong>Launch OrthoNex Demo</strong>.
              </p>
            </div>

            <div className="px-lg py-sm bg-surface-container-low border-t border-surface-container flex justify-end">
              <button
                onClick={() => setShowForgotModal(false)}
                className="px-md py-1.5 rounded-lg bg-primary text-on-primary font-label-md text-xs font-bold shadow-xs hover:bg-primary-container transition"
                type="button"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
