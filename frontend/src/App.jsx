import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import PatientBanner from './components/PatientBanner';
import TeleconsultDrawer from './components/TeleconsultDrawer';
import EnrollModal from './components/EnrollModal';

import OverviewView from './views/OverviewView';
import GaitHudView from './views/GaitHudView';
import QuestionnaireView from './views/QuestionnaireView';
import DiagnosticReportView from './views/DiagnosticReportView';
import PatientsCohortView from './views/PatientsCohortView';
import HardwareFleetView from './views/HardwareFleetView';
import CompleteProfileView from './views/CompleteProfileView';

import LoginView from './views/LoginView';
import { checkBackendHealth, getPatients, createPatient, saveScreening, getLatestScreening } from './utils/api';
import { useCamera } from './utils/useCamera';
import { getStoredUser, logoutUser, fetchServerUserProfile, getRoleConfig, isTabAllowedForRole } from './utils/auth';

const VALID_TABS = ['overview', 'survey', 'gait', 'report', 'cohort', 'hardware'];

function getInitialTab(roleId = 'screener') {
  if (typeof window === 'undefined') return 'overview';
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  if (VALID_TABS.includes(hash) && isTabAllowedForRole(roleId, hash)) return hash;
  const stored = sessionStorage.getItem('orthonex_active_tab');
  if (VALID_TABS.includes(stored) && isTabAllowedForRole(roleId, stored)) return stored;
  return getRoleConfig(roleId).defaultTab;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const camera = useCamera(Boolean(currentUser));
  const [activeTab, setActiveTab] = useState(() => getInitialTab(currentUser?.roleId || 'screener'));
  const scrollPositions = useRef({});
  const isHandlingPopState = useRef(false);

  const [backendOnline, setBackendOnline] = useState(false);
  const [patients, setPatients] = useState([]);
  const [activePatient, setActivePatient] = useState(null);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showTeleconsult, setShowTeleconsult] = useState(false);

  // Cross-module diagnostic state
  const [surveyResult, setSurveyResult] = useState(null);
  const [gaitResult, setGaitResult] = useState(null);
  const [xrayResult, setXrayResult] = useState(null);

  // 1. Check for server-side OAuth session on mount or return from Google redirect
  useEffect(() => {
    let isMounted = true;
    const params = new URLSearchParams(window.location.search);
    const hasAuthSuccess = params.get('auth_success');
    const authError = params.get('auth_error');

    if (hasAuthSuccess || authError) {
      if (authError) {
        alert('Google Authentication Error: ' + authError);
      }
      // Clean query params from URL bar without reload
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Attempt to resolve active session from backend cookie
    fetchServerUserProfile().then((serverUser) => {
      if (isMounted && serverUser) {
        const stored = getStoredUser();
        if (stored && stored.id === serverUser.id && stored.profileCompleted) {
          setCurrentUser({ ...serverUser, ...stored });
        } else {
          setCurrentUser(serverUser);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // 1b. History & Navigation Engine (Prevents back-button loops, persists tab, restores scroll)
  useEffect(() => {
    const initial = getInitialTab();
    const currentState = window.history.state;
    if (!currentState || !currentState.tab) {
      window.history.replaceState(
        { tab: initial, isRoot: true, index: 0 },
        document.title,
        window.location.hash || `#${initial}`
      );
    }
    sessionStorage.setItem('orthonex_active_tab', initial);

    const handlePopState = (event) => {
      const stateTab = event.state?.tab;
      if (stateTab && VALID_TABS.includes(stateTab)) {
        isHandlingPopState.current = true;
        setActiveTab(stateTab);
        sessionStorage.setItem('orthonex_active_tab', stateTab);

        const targetScroll = scrollPositions.current[stateTab] || 0;
        requestAnimationFrame(() => {
          window.scrollTo({ top: targetScroll, behavior: 'instant' });
          setTimeout(() => {
            isHandlingPopState.current = false;
          }, 60);
        });
      } else {
        setActiveTab('overview');
        sessionStorage.setItem('orthonex_active_tab', 'overview');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleNavigate = (newTab, options = {}) => {
    if (!VALID_TABS.includes(newTab)) return;
    const currentRoleId = currentUser?.roleId || 'screener';
    if (!isTabAllowedForRole(currentRoleId, newTab)) {
      const defaultTab = getRoleConfig(currentRoleId).defaultTab;
      if (activeTab !== defaultTab) {
        handleNavigate(defaultTab, { replace: true });
      }
      return;
    }
    if (newTab === activeTab && !options.force) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    scrollPositions.current[activeTab] = window.scrollY;

    const currentIndex = window.history.state?.index ?? 0;
    if (options.replace) {
      window.history.replaceState({ tab: newTab, index: currentIndex }, document.title, `#${newTab}`);
    } else {
      window.history.pushState({ tab: newTab, index: currentIndex + 1 }, document.title, `#${newTab}`);
    }

    setActiveTab(newTab);
    sessionStorage.setItem('orthonex_active_tab', newTab);

    const targetScroll = options.scrollToTop ? 0 : (scrollPositions.current[newTab] || 0);
    requestAnimationFrame(() => {
      window.scrollTo({ top: targetScroll, behavior: options.smooth ? 'smooth' : 'instant' });
    });
  };

  // 1c. Role Route Guard: Auto-redirect if current role does not have access to activeTab
  useEffect(() => {
    if (!currentUser) return;
    const currentRoleId = currentUser?.roleId || 'screener';
    if (!isTabAllowedForRole(currentRoleId, activeTab)) {
      const targetTab = getRoleConfig(currentRoleId).defaultTab;
      handleNavigate(targetTab, { replace: true });
    }
  }, [currentUser?.roleId, activeTab]);

  // 2. Only initialize protected clinical data and queries when an authenticated session exists
  useEffect(() => {
    if (!currentUser) return;

    let isMounted = true;
    async function initDashboardData() {
      const health = await checkBackendHealth();
      if (isMounted) setBackendOnline(health.status === 'ok');

      const pts = await getPatients(currentUser);
      if (isMounted) {
        if (pts && pts.length > 0) {
          setPatients(pts);
          setActivePatient(pts[0]);
        } else {
          setPatients([]);
          setActivePatient(null);
        }
      }
    }

    initDashboardData();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  // 3. Auto-load latest persisted screening whenever the active patient changes
  useEffect(() => {
    setXrayResult(null);
    if (!activePatient?.dbId) {
      setSurveyResult(null);
      setGaitResult(null);
      return;
    }

    let isMounted = true;
    getLatestScreening(activePatient.dbId)
      .then((screening) => {
        if (!isMounted || !screening) return;
        if (screening.questionnaire_score != null) {
          setSurveyResult({
            raw_score: screening.questionnaire_score,
            compositeScore: screening.questionnaire_score,
            category: screening.questionnaire_category || 'moderate',
            pain: Math.min(10, Math.round(screening.questionnaire_score / 4)),
            stiffness: 35
          });
        }
        if (screening.movement_category || screening.gait_metrics_json) {
          let metrics = {};
          try {
            metrics = screening.gait_metrics_json ? JSON.parse(screening.gait_metrics_json) : {};
          } catch {}
          setGaitResult({
            risk: screening.movement_category === 'high' ? 'High Risk (Antalgic Asymmetry)' : screening.movement_category === 'low' ? 'Low Risk (Symmetric)' : 'Moderate Risk (Early OA Markers)',
            confidence: Math.round((screening.movement_confidence || 0.85) * 100),
            cadence: metrics.cadence || 94,
            velocity: metrics.velocity || 0.86,
            strideLength: metrics.strideLength || 1.18,
            kneeAngleAsymmetry: metrics.kneeAngleAsymmetry || '+14.2°',
            affectedLimb: metrics.affectedLimb || 'Right Limb (Sagittal Deficit)',
            recommendation: 'Restored from persisted clinical screening record'
          });
        }
      })
      .catch((err) => {
        console.warn('Could not load latest screening:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [activePatient?.dbId]);

  const handleEnrollPatient = async (newPatient) => {
    const created = await createPatient(newPatient);
    const patient = { ...newPatient, dbId: created.id, id: newPatient.id || `IND-OA-2025-${String(created.id).padStart(4, '0')}` };
    setPatients((prev) => [patient, ...prev]);
    setActivePatient(patient);
  };

  const handleSwitchPatient = () => {
    if (!patients || patients.length === 0) return;
    const currentIndex = patients.findIndex((p) => p.id === activePatient?.id);
    const nextIndex = (currentIndex + 1) % patients.length;
    setActivePatient(patients[nextIndex]);
  };

  const handleGaitComplete = async (res) => {
    setGaitResult(res);
    if (activePatient?.dbId) {
      try {
        await saveScreening({
          patient_id: activePatient.dbId,
          survey_score: surveyResult?.compositeScore || surveyResult?.raw_score || 24,
          movement_score: res.confidence || 85,
          combined_risk: res.risk?.includes('High') ? 'high' : res.risk?.includes('Moderate') ? 'moderate' : 'low',
          questionnaire_score: surveyResult?.compositeScore || surveyResult?.raw_score || 24,
          questionnaire_category: surveyResult?.category || 'moderate',
          movement_category: res.risk?.includes('High') ? 'high' : res.risk?.includes('Low') ? 'low' : 'moderate',
          movement_confidence: (res.confidence || 85) / 100,
          gait_metrics_json: JSON.stringify(res),
          vitals: surveyResult?.vitals || null,
          clinical_symptoms: surveyResult?.clinical_symptoms || null,
          clinical_prediction: surveyResult?.clinical_prediction || null,
          xray_grade: 'Not assessed',
          data_source: res.sourceType || 'live_test',
          simulation_status: currentUser?.isDemo ? 'offline_simulation' : 'real_assessment'
        });
      } catch (err) {
        console.warn('Could not save screening to backend:', err);
      }
    }
  };

  const handleSurveySubmitted = async (res) => {
    setSurveyResult(res);
    if (activePatient?.dbId) {
      try {
        await saveScreening({
          patient_id: activePatient.dbId,
          survey_score: res.compositeScore || res.raw_score || 24,
          movement_score: gaitResult?.confidence || 85,
          combined_risk: res.category === 'high' ? 'high' : res.category === 'low' ? 'low' : 'moderate',
          questionnaire_score: res.compositeScore || res.raw_score || 24,
          questionnaire_category: res.category || 'moderate',
          movement_category: gaitResult?.risk?.includes('High') ? 'high' : 'moderate',
          movement_confidence: (gaitResult?.confidence || 85) / 100,
          gait_metrics_json: gaitResult ? JSON.stringify(gaitResult) : null,
          vitals: res.vitals || null,
          clinical_symptoms: res.clinical_symptoms || null,
          clinical_prediction: res.clinical_prediction || null,
          xray_grade: 'Not assessed',
          data_source: 'clinical_triage_v2',
          simulation_status: currentUser?.isDemo ? 'offline_simulation' : 'real_assessment'
        });
      } catch (err) {
        console.warn('Could not save screening to backend:', err);
      }
    }
  };

  const handleLogin = (user) => {
    setCurrentUser(user);
  };

  const handleSwitchAccount = (newAccount) => {
    setCurrentUser(newAccount);
    const newRoleId = newAccount?.roleId || 'screener';
    if (!isTabAllowedForRole(newRoleId, activeTab)) {
      const defaultTab = getRoleConfig(newRoleId).defaultTab;
      handleNavigate(defaultTab, { replace: true });
    }
  };

  const handleLogout = () => {
    if (camera?.isWebcamActive) {
      camera.stopCamera();
    }
    logoutUser();
    setCurrentUser(null);
    setPatients([]);
    setActivePatient(null);
    setSurveyResult(null);
    setGaitResult(null);
    setXrayResult(null);
  };

  // Route protection: If unauthenticated, render clinical login portal
  if (!currentUser) {
    return <LoginView onLogin={handleLogin} />;
  }

  // Profile completion check for Google auth users (or incomplete mocked profiles)
  const isGoogleUser = currentUser?.id?.startsWith('NER-GOOG');
  if (!currentUser.roleId || !currentUser.station || (isGoogleUser && !currentUser.profileCompleted)) {
    return <CompleteProfileView currentUser={currentUser} onComplete={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-background font-body-md text-on-surface flex flex-col selection:bg-primary-fixed selection:text-on-primary-fixed">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={handleNavigate}
        onOpenTeleconsult={() => setShowTeleconsult(true)}
        backendOnline={backendOnline}
        camera={camera}
        currentUser={currentUser}
        activePatient={activePatient}
        onSwitchAccount={handleSwitchAccount}
        onLogout={handleLogout}
      />

      {/* Patient Demographic & Status Strip */}
      <div className="pt-header-height">
        <PatientBanner
          activePatient={activePatient}
          onSwitchPatient={handleSwitchPatient}
          onOpenEnrollModal={() => setShowEnrollModal(true)}
          surveyResult={surveyResult}
          gaitResult={gaitResult}
          currentUser={currentUser}
        />
      </div>

      {/* Main Workspace Canvas */}
      <main className="w-full flex-1 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'overview' && (
          <OverviewView
            activePatient={activePatient}
            onNavigate={handleNavigate}
            surveyResult={surveyResult}
            onSurveySubmitted={handleSurveySubmitted}
            gaitResult={gaitResult}
            xrayResult={xrayResult}
            onXrayAnalyzed={setXrayResult}
            onOpenTeleconsult={() => setShowTeleconsult(true)}
            camera={camera}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'gait' && (
          <GaitHudView
            activePatient={activePatient}
            surveyResult={surveyResult}
            onAnalysisComplete={handleGaitComplete}
            xrayData={xrayResult}
            onXrayAnalyzed={setXrayResult}
            onNavigate={handleNavigate}
            onOpenTeleconsult={() => setShowTeleconsult(true)}
            camera={camera}
          />
        )}

        {activeTab === 'survey' && (
          <QuestionnaireView
            activePatient={activePatient}
            onSurveySubmitted={handleSurveySubmitted}
            onOpenTeleconsult={() => setShowTeleconsult(true)}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab === 'report' && (
          <DiagnosticReportView
            activePatient={activePatient}
            surveyResult={surveyResult}
            gaitResult={gaitResult}
            xrayData={xrayResult}
            onXrayAnalyzed={setXrayResult}
            onOpenTeleconsult={() => setShowTeleconsult(true)}
            onNavigate={handleNavigate}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'cohort' && (
          <PatientsCohortView
            patients={patients}
            activePatient={activePatient}
            onSelectPatient={(p) => setActivePatient(p)}
            onOpenEnrollModal={() => setShowEnrollModal(true)}
            onNavigate={handleNavigate}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'hardware' && (
          <HardwareFleetView
            currentUser={currentUser}
            onNavigate={handleNavigate}
            camera={camera}
          />
        )}
      </main>

      {/* Floating Teleconsult & Referral Desk */}
      <TeleconsultDrawer
        isOpen={showTeleconsult}
        onClose={() => setShowTeleconsult(false)}
        activePatient={activePatient}
        screeningData={{
          category: gaitResult?.risk?.includes('High') || surveyResult?.category === 'high' ? 'High' : 'Moderate',
          score: surveyResult?.raw_score || 24
        }}
      />

      {/* Enroll Patient Modal */}
      <EnrollModal
        isOpen={showEnrollModal}
        onClose={() => setShowEnrollModal(false)}
        onEnroll={handleEnrollPatient}
      />

      {/* Clinical Platform Footer */}
      <footer className="w-full bg-surface-container-lowest shadow-[0_-1px_4px_rgba(0,0,0,0.03)] border-t border-surface-container py-md mt-auto">
        <div className="max-w-[1600px] mx-auto px-lg flex flex-wrap items-center justify-between gap-sm text-on-surface-variant font-body-sm text-[12px]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-on-surface">OrthoNex AI Musculoskeletal Triage Platform</span>
            <span>·</span>
            <span>ICMR-RMRC North East Joint Tele-Screening Initiative</span>
          </div>
          <div className="flex items-center gap-md">
            <span className="font-data-mono text-secondary">Sync Node: Diphu-PHC-04</span>
            <span className="text-outline-variant">|</span>
            <span className="text-on-surface-variant font-medium">v3.4.2-clinical-lts</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
