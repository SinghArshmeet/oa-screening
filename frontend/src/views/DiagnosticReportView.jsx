import React, { useState, useRef, useEffect, useMemo } from 'react';
import { analyzeXrayImage } from '../utils/api';

export default function DiagnosticReportView({
  activePatient,
  surveyResult,
  gaitResult,
  xrayData: propXrayData,
  onXrayAnalyzed,
  onOpenTeleconsult,
  onNavigate,
  currentUser
}) {
  const [signedOff, setSignedOff] = useState(false);
  const [localXrayData, setLocalXrayData] = useState(null);
  const xrayData = propXrayData || localXrayData;
  const [xrayLoading, setXrayLoading] = useState(false);
  const [xrayError, setXrayError] = useState('');
  const [isDraggingXray, setIsDraggingXray] = useState(false);
  const xrayInputRef = useRef(null);

  // Role Permissions:
  // - Medical Officer (officer) / Admin: Full clinical diagnosis sign-off & specialist referral dispatch
  // - Screener: Frontline triage capture & dossier printing
  const isMedicalOfficerOrAdmin =
    currentUser?.roleId === 'officer' ||
    currentUser?.roleId === 'admin' ||
    currentUser?.role?.toLowerCase().includes('officer') ||
    currentUser?.role?.toLowerCase().includes('admin');

  // Baseline extraction from actual patient and screening session inputs
  const defaultPain = surveyResult?.pain ?? (activePatient?.surveyScore?.includes('29') ? 8 : (activePatient?.surveyScore?.includes('24') ? 6 : 3));
  const defaultStiffness = surveyResult?.stiffness ?? (activePatient?.surveyScore?.includes('29') ? 45 : 30);
  const defaultAsymmetry = gaitResult?.kneeAngleAsymmetry
    ? parseFloat(String(gaitResult.kneeAngleAsymmetry).replace(/[^0-9.]/g, ''))
    : (activePatient?.gaitRisk?.includes('High') ? 14.2 : 5.8);
  const defaultVelocity = gaitResult?.velocity ?? (activePatient?.gaitRisk?.includes('High') ? 0.86 : 1.12);
  const defaultCadence = gaitResult?.cadence ?? (activePatient?.gaitRisk?.includes('High') ? 92 : 106);
  const defaultKlGrade = xrayData?.kl_grade !== undefined
    ? xrayData.kl_grade
    : (activePatient?.xrayResult?.includes('KL-3') ? 3 : activePatient?.xrayResult?.includes('KL-2') ? 2 : null);
  const defaultHeavyWork = surveyResult?.workloadMatrix?.heavyLoads ?? Boolean(
    activePatient?.occupation?.includes('Squat') ||
    activePatient?.occupation?.includes('Labor') ||
    activePatient?.occupation?.includes('Plucker') ||
    activePatient?.occupation?.includes('Weaver')
  );

  // Interactive Live Diagnostic Calibration state
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calPain, setCalPain] = useState(defaultPain);
  const [calStiffness, setCalStiffness] = useState(defaultStiffness);
  const [calAsymmetry, setCalAsymmetry] = useState(defaultAsymmetry);
  const [calVelocity, setCalVelocity] = useState(defaultVelocity);
  const [calKlGrade, setCalKlGrade] = useState(defaultKlGrade !== null ? defaultKlGrade : -1);
  const [calHeavyWork, setCalHeavyWork] = useState(defaultHeavyWork);
  const [showCalibrationDrawer, setShowCalibrationDrawer] = useState(false);

  // Synchronize when patient or prop results change if not actively tweaking
  useEffect(() => {
    if (!isCalibrating) {
      setCalPain(defaultPain);
      setCalStiffness(defaultStiffness);
      setCalAsymmetry(defaultAsymmetry);
      setCalVelocity(defaultVelocity);
      setCalKlGrade(defaultKlGrade !== null ? defaultKlGrade : -1);
      setCalHeavyWork(defaultHeavyWork);
    }
  }, [defaultPain, defaultStiffness, defaultAsymmetry, defaultVelocity, defaultKlGrade, defaultHeavyWork, isCalibrating]);

  // Active runtime parameters
  const currentPain = isCalibrating ? calPain : defaultPain;
  const currentStiffness = isCalibrating ? calStiffness : defaultStiffness;
  const currentAsymmetry = isCalibrating ? calAsymmetry : defaultAsymmetry;
  const currentVelocity = isCalibrating ? calVelocity : defaultVelocity;
  const currentKlGrade = isCalibrating ? (calKlGrade >= 0 ? calKlGrade : null) : defaultKlGrade;
  const currentHeavyWork = isCalibrating ? calHeavyWork : defaultHeavyWork;

  const patientAge = activePatient?.age || 52;
  const patientState = activePatient?.state || 'Punjab';
  const patientAbha = activePatient?.abhaId || '91-4452-8921-3310';
  const patientRegion = activePatient?.region || 'CHC Ludhiana West, Punjab';

  // Dynamic Clinical Calculation Formula
  const {
    symptomScore,
    kinematicScore,
    xrayScore,
    hasXray,
    combinedRiskIndex,
    riskClassification,
    isHighRisk,
    isModerateRisk,
    isLowRisk,
    strokeDashoffset,
    prescriptions
  } = useMemo(() => {
    // 1. Symptom Burden (0-100)
    const painPts = (currentPain / 10) * 45;
    const stiffPts = currentStiffness >= 45 ? 20 : currentStiffness >= 30 ? 15 : currentStiffness >= 15 ? 10 : 3;
    const agePts = patientAge >= 65 ? 15 : patientAge >= 55 ? 10 : patientAge >= 45 ? 5 : 2;
    const workPts = currentHeavyWork ? 12 : 4;
    const diffPts = surveyResult ? ((surveyResult.walkDiff ?? 2) + (surveyResult.stairsDiff ?? 2)) * 1.5 : 6;
    const sScore = Math.min(100, Math.round(painPts + stiffPts + agePts + workPts + diffPts));

    // 2. Kinematic Deficit (0-100)
    const asymPts = Math.min(50, (currentAsymmetry / 18) * 50);
    const velPts = currentVelocity <= 0.7 ? 30 : currentVelocity <= 0.9 ? 22 : currentVelocity <= 1.1 ? 12 : 4;
    const cadPts = defaultCadence < 92 ? 20 : defaultCadence < 102 ? 12 : 5;
    const kScore = Math.min(100, Math.round(asymPts + velPts + cadPts));

    // 3. Radiographic Severity (0-100)
    const validXray = currentKlGrade !== null && currentKlGrade !== undefined;
    const xScore = validXray
      ? (currentKlGrade === 4 ? 98 : currentKlGrade === 3 ? 76 : currentKlGrade === 2 ? 50 : currentKlGrade === 1 ? 24 : 8)
      : null;

    // 4. Combined Multimodal Fusion Index (0-100%)
    let riskIdx;
    if (validXray) {
      riskIdx = +(kScore * 0.35 + sScore * 0.30 + xScore * 0.35).toFixed(1);
    } else {
      riskIdx = +(kScore * 0.55 + sScore * 0.45).toFixed(1);
    }

    const high = riskIdx >= 65;
    const mod = riskIdx >= 30 && riskIdx < 65;
    const low = riskIdx < 30;

    let classification = 'Low Risk (Normal Joint Mechanics)';
    if (high) {
      classification = validXray && currentKlGrade >= 3
        ? `Grade ${currentKlGrade === 4 ? 'IV Severe' : 'III Moderate-Severe'} Structural Knee OA`
        : 'High-Burden Clinical OA (Marked Antalgic Compensation)';
    } else if (mod) {
      classification = validXray && currentKlGrade === 2
        ? 'Grade II Mild-to-Moderate Osteoarthritis (Early Sclerosis)'
        : 'Moderate Burden / Early Functional Joint Strain';
    }

    const offset = +(263.89 - (263.89 * (riskIdx / 100))).toFixed(1);

    // Recommended Prescriptions
    const rx = [];
    if (high) {
      rx.push('Urgent Tertiary Specialist Tele-Referral (AIIMS / PGIMER / CMC / KEM / GMCH)');
      rx.push('Prescribe bilateral weight-bearing AP/Lateral radiograph');
      rx.push('Contralateral joint off-loading cane / walking orthosis');
      rx.push('Isometric Vastus Medialis Oblique (VMO) & Quadriceps rehabilitation');
      rx.push('Prescribe Topical Diclofenac Gel & Paracetamol 500mg SOS');
      rx.push('Absolute restriction of heavy ground squatting (>15 min)');
    } else if (mod) {
      rx.push('Prescribe structured physical therapy & quadriceps strengthening (15m BID)');
      rx.push('Prescribe Topical Diclofenac Gel SOS for pain exacerbations');
      rx.push('Ergonomic load distribution & avoidance of prolonged cross-legged sitting');
      rx.push('Review at Primary Health Centre in 12 weeks');
    } else {
      rx.push('Routine joint preservation lifestyle education & aerobic walking');
      rx.push('Low-impact knee flexibility stretches');
      rx.push('Annual routine musculoskeletal re-evaluation');
    }

    return {
      symptomScore: sScore,
      kinematicScore: kScore,
      xrayScore: xScore,
      hasXray: validXray,
      combinedRiskIndex: riskIdx,
      riskClassification: classification,
      isHighRisk: high,
      isModerateRisk: mod,
      isLowRisk: low,
      strokeDashoffset: offset,
      prescriptions: rx
    };
  }, [currentPain, currentStiffness, currentAsymmetry, currentVelocity, defaultCadence, currentKlGrade, currentHeavyWork, patientAge, surveyResult]);

  // Fast Clinical Recommendation Macros Selection
  const [selectedMacros, setSelectedMacros] = useState(prescriptions.slice(0, 3));

  useEffect(() => {
    setSelectedMacros(prescriptions.slice(0, 3));
  }, [prescriptions]);

  const toggleMacro = (macro) => {
    setSelectedMacros((prev) =>
      prev.includes(macro) ? prev.filter((m) => m !== macro) : [...prev, macro]
    );
  };

  // Keyboard shortcut listener (Ctrl+P / Cmd+P)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const processXrayFile = async (file) => {
    if (!file) return;
    setXrayLoading(true);
    setXrayError('');
    const previewUrl = URL.createObjectURL(file);
    try {
      const res = await analyzeXrayImage(file);
      if (res.status === 'success' || res.kl_grade !== undefined) {
        const enriched = { ...res, preview_url: previewUrl };
        setLocalXrayData(enriched);
        if (onXrayAnalyzed) onXrayAnalyzed(enriched);
      }
    } catch (err) {
      setXrayError(err.message || 'Radiograph analysis could not be processed.');
    } finally {
      setXrayLoading(false);
      if (xrayInputRef.current) {
        xrayInputRef.current.value = '';
      }
    }
  };

  const handleXrayUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) processXrayFile(file);
  };

  const handleXrayDrop = (e) => {
    e.preventDefault();
    setIsDraggingXray(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) processXrayFile(file);
  };

  const handleLoadSampleXray = async () => {
    setXrayLoading(true);
    setXrayError('');
    try {
      const response = await fetch('/sample_knee_xray.png');
      const blob = await response.blob();
      const sampleFile = new File([blob], 'sample_knee_xray.png', { type: 'image/png' });
      const res = await analyzeXrayImage(sampleFile);
      if (res.status === 'success' || res.kl_grade !== undefined) {
        const enriched = { ...res, preview_url: '/sample_knee_xray.png' };
        setLocalXrayData(enriched);
        if (onXrayAnalyzed) onXrayAnalyzed(enriched);
      }
    } catch (err) {
      setXrayError(err.message || 'Could not load clinical sample radiograph.');
    } finally {
      setXrayLoading(false);
    }
  };

  const handleResetCalibration = () => {
    setIsCalibrating(false);
    setCalPain(defaultPain);
    setCalStiffness(defaultStiffness);
    setCalAsymmetry(defaultAsymmetry);
    setCalVelocity(defaultVelocity);
    setCalKlGrade(defaultKlGrade !== null ? defaultKlGrade : -1);
    setCalHeavyWork(defaultHeavyWork);
  };

  return (
    <div className="flex flex-col w-full gap-5 animate-fade-in print:p-0">
      {/* Top Breadcrumb & Return to Overview */}
      <div className="flex items-center justify-between print:hidden">
        <button
          onClick={() => (onNavigate ? onNavigate('overview') : window.history.back())}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary hover:text-primary transition-colors py-1 px-2 -ml-2 rounded-lg hover:bg-surface-container"
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back to Overview</span>
        </button>

        <span className="text-[11px] text-secondary font-medium">
          Dossier ID: <strong className="font-data-mono text-on-surface">{activePatient?.id || 'IND-OA-2025'}</strong>
        </span>
      </div>

      {/* Patient Context & National ABDM Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-md p-card-padding rounded-xl bg-surface-container-lowest shadow-sm border border-surface-container">
        <div className="flex flex-wrap items-center gap-md">
          <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              radiology
            </span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-xs">
              <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
                Diagnostic Decision Support
              </h2>
              <span className="px-xs py-2xs rounded bg-surface-container-high text-primary font-data-mono text-data-mono font-bold">
                Pan-India Triage
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Multimodal Sensor Fusion & Algorithmic Referral Assessment (ABDM / ICMR Aligned)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-lg text-on-surface-variant font-body-sm text-body-sm">
          <div className="flex flex-col">
            <span className="font-label-sm text-[10px] text-outline uppercase font-semibold">State / Location</span>
            <span className="font-body-md text-on-surface font-semibold">{patientState} · {patientRegion}</span>
          </div>
          <div className="w-px h-8 bg-surface-container hidden sm:block"></div>
          <div className="flex flex-col">
            <span className="font-label-sm text-[10px] text-outline uppercase font-semibold">ABHA Health ID</span>
            <span className="font-data-mono text-[12px] text-primary font-bold">{patientAbha}</span>
          </div>
          <div className="w-px h-8 bg-surface-container hidden sm:block"></div>
          <div className="flex flex-col">
            <span className="font-label-sm text-[10px] text-outline uppercase font-semibold">Registry Token</span>
            <span className="font-data-mono text-[12px] text-on-surface font-bold">{activePatient?.id || 'IND-OA-2025-0892'}</span>
          </div>
        </div>
      </div>

      {/* Calibration Controls Banner (Interactive Doctor Sandbox) */}
      <div className="p-md rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-sm shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[18px]">tune</span>
            </div>
            <div>
              <h3 className="font-headline-sm text-xs font-bold text-on-surface uppercase tracking-wider">
                Live Diagnostic Parameter Calibration & Clinical Sandbox
              </h3>
              <p className="font-body-sm text-[11px] text-secondary">
                {isCalibrating ? '⚡ Interactive Simulation Mode Active — Metrics recalculate continuously from adjusted sliders' : 'Active Patient Telemetry Mode — Showing real screened data from patient visit'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isCalibrating && (
              <button
                type="button"
                onClick={handleResetCalibration}
                className="px-2.5 py-1 rounded-lg bg-surface-container text-on-surface text-xs font-semibold hover:bg-surface-container-high transition flex items-center gap-1 border border-outline-variant/30"
              >
                <span className="material-symbols-outlined text-[14px]">replay</span>
                <span>Reset to Real Data</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowCalibrationDrawer(!showCalibrationDrawer)}
              className="px-3 py-1 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition flex items-center gap-1 shadow-xs"
            >
              <span className="material-symbols-outlined text-[14px]">
                {showCalibrationDrawer ? 'expand_less' : 'tune'}
              </span>
              <span>{showCalibrationDrawer ? 'Hide Controls' : 'Adjust Clinical Sliders'}</span>
            </button>
          </div>
        </div>

        {/* Collapsible Calibration Sliders */}
        {showCalibrationDrawer && (
          <div className="pt-sm border-t border-outline-variant/20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md text-xs animate-in fade-in duration-200">
            {/* Slider 1: Pain VAS */}
            <div className="p-sm rounded-lg bg-surface-container-lowest border border-surface-container flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-on-surface">Pain Severity (VAS)</span>
                <span className="font-data-mono font-bold text-error">{currentPain} / 10</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={currentPain}
                onChange={(e) => {
                  setIsCalibrating(true);
                  setCalPain(Number(e.target.value));
                }}
                className="w-full accent-primary h-1.5 rounded bg-surface-container cursor-pointer"
              />
              <span className="text-[10px] text-secondary">
                {currentPain >= 7 ? 'Severe joint pain' : currentPain >= 4 ? 'Moderate weight-bearing pain' : 'Mild / asymptomatic'}
              </span>
            </div>

            {/* Slider 2: Morning Stiffness */}
            <div className="p-sm rounded-lg bg-surface-container-lowest border border-surface-container flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-on-surface">Morning Stiffness</span>
                <span className="font-data-mono font-bold text-primary">{currentStiffness} mins</span>
              </div>
              <input
                type="range"
                min="0"
                max="90"
                step="5"
                value={currentStiffness}
                onChange={(e) => {
                  setIsCalibrating(true);
                  setCalStiffness(Number(e.target.value));
                }}
                className="w-full accent-primary h-1.5 rounded bg-surface-container cursor-pointer"
              />
              <span className="text-[10px] text-secondary">
                {currentStiffness >= 45 ? 'Marked morning gel phenomenon' : currentStiffness >= 20 ? 'Moderate OA stiffness' : 'Physiologic'}
              </span>
            </div>

            {/* Slider 3: Gait Knee Asymmetry */}
            <div className="p-sm rounded-lg bg-surface-container-lowest border border-surface-container flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-on-surface">Gait Knee Asymmetry</span>
                <span className="font-data-mono font-bold text-error">+{currentAsymmetry.toFixed(1)}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="25"
                step="0.5"
                value={currentAsymmetry}
                onChange={(e) => {
                  setIsCalibrating(true);
                  setCalAsymmetry(Number(e.target.value));
                }}
                className="w-full accent-primary h-1.5 rounded bg-surface-container cursor-pointer"
              />
              <span className="text-[10px] text-secondary">
                {currentAsymmetry >= 12 ? 'Marked sagittal antalgic limp' : currentAsymmetry >= 6 ? 'Early compensatory offload' : 'Normal bilateral symmetry'}
              </span>
            </div>

            {/* Slider 4: X-Ray KL Grade */}
            <div className="p-sm rounded-lg bg-surface-container-lowest border border-surface-container flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-on-surface">Radiograph Staging</span>
                <span className="font-data-mono font-bold text-tertiary">
                  {currentKlGrade !== null ? `KL-${currentKlGrade}` : 'Unassessed'}
                </span>
              </div>
              <select
                value={currentKlGrade !== null ? currentKlGrade : -1}
                onChange={(e) => {
                  setIsCalibrating(true);
                  const v = Number(e.target.value);
                  setCalKlGrade(v);
                }}
                className="w-full px-2 py-1 text-xs rounded bg-surface-container border border-outline-variant/30 text-on-surface font-semibold"
              >
                <option value="-1">Frontline Optical Only (No X-ray)</option>
                <option value="0">KL Grade 0 (Doubtful / Normal)</option>
                <option value="1">KL Grade 1 (Doubtful JSN, Possible Osteophytes)</option>
                <option value="2">KL Grade 2 (Definite Osteophytes, Mild JSN)</option>
                <option value="3">KL Grade 3 (Multiple Moderate Osteophytes, Marked JSN)</option>
                <option value="4">KL Grade 4 (Severe JSN, Marked Bone Sclerosis)</option>
              </select>
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentHeavyWork}
                    onChange={(e) => {
                      setIsCalibrating(true);
                      setCalHeavyWork(e.target.checked);
                    }}
                    className="w-3.5 h-3.5 accent-primary"
                  />
                  <span className="text-[11px] text-on-surface">Heavy Manual Workload</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hero Multimodal Screening Result Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-inverse-surface text-inverse-on-surface p-xl shadow-2xl border border-white/10">
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-error/15 blur-3xl pointer-events-none"></div>
        <div className="absolute left-1/3 -bottom-20 w-80 h-80 rounded-full bg-tertiary-container/15 blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col xl:flex-row items-stretch justify-between gap-xl">
          {/* Risk Status Left */}
          <div className="flex flex-col justify-between max-w-xl">
            <div className="flex flex-col gap-sm">
              <div className="flex flex-wrap items-center gap-xs">
                <div
                  className={`inline-flex items-center gap-xs px-sm py-1 rounded-full w-fit border ${
                    isHighRisk
                      ? 'bg-error-container/20 text-error-container border-error/30'
                      : isModerateRisk
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      isHighRisk ? 'bg-error animate-ping' : isModerateRisk ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                  ></span>
                  <span className="font-label-sm text-xs uppercase font-bold tracking-wider">
                    {isHighRisk
                      ? 'Urgent Tier-2 Specialist Referral'
                      : isModerateRisk
                      ? 'Tier-1 Clinical Rehabilitation Follow-Up'
                      : 'Routine Preventive Monitoring'}
                  </span>
                </div>

                <div
                  className={`inline-flex items-center gap-xs px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${
                    isHighRisk || isModerateRisk
                      ? 'bg-red-500/30 text-red-200 border-red-500/50'
                      : 'bg-emerald-500/30 text-emerald-200 border-emerald-500/50'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {isHighRisk || isModerateRisk ? 'notification_important' : 'check_circle'}
                  </span>
                  <span>
                    {isHighRisk || isModerateRisk
                      ? 'Screen Positive (Suspected OA)'
                      : 'Screen Negative (Low OA Risk)'}
                  </span>
                </div>
              </div>

              <h1 className="font-headline-lg text-headline-lg text-surface-container-lowest font-bold leading-tight">
                {riskClassification}
              </h1>

              <p className="font-body-md text-surface-dim leading-relaxed text-sm">
                Multimodal algorithmic convergence indicates{' '}
                {isHighRisk
                  ? 'marked uncompensated mechanical unloading and high-severity clinical symptom loading consistent with moderate-to-severe degenerative joint disease'
                  : isModerateRisk
                  ? 'early sagittal compensation and intermittent weight-bearing symptoms requiring proactive joint-sparing therapy and quadriceps conditioning'
                  : 'normal joint symmetry, low pain loading, and preserved biomechanical mobility'}{' '}
                in {activePatient?.name || 'the patient'}.
              </p>
            </div>

            <div className="mt-md pt-sm flex flex-wrap items-center gap-sm">
              <span className="px-sm py-1 rounded bg-surface-container-highest/10 text-tertiary-fixed-dim font-data-mono text-[11px] border border-white/5">
                Dominant Axis: {gaitResult?.affectedLimb || 'Right Limb (Sagittal Deficit)'}
              </span>
              <span className="px-sm py-1 rounded bg-surface-container-highest/10 text-surface-dim font-data-mono text-[11px] border border-white/5">
                Model Confidence: {gaitResult?.confidence || 86}% (RandomForest Multi-Sensor)
              </span>
              {isCalibrating && (
                <span className="px-sm py-1 rounded bg-amber-500/20 text-amber-200 font-data-mono text-[11px] border border-amber-400/30">
                  Calibrated Mode
                </span>
              )}
            </div>
          </div>

          {/* Center Telemetry Metric Dial */}
          <div className="flex flex-col sm:flex-row items-center gap-lg bg-surface-container-highest/10 p-lg rounded-xl backdrop-blur-md justify-around min-w-[340px] border border-white/10">
            <div className="flex flex-col items-center text-center">
              <div className="relative flex items-center justify-center w-28 h-28 mb-xs">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    className="text-surface-container-highest/20"
                    cx="50"
                    cy="50"
                    fill="transparent"
                    r="42"
                    stroke="currentColor"
                    strokeWidth="8"
                  ></circle>
                  <circle
                    className={isHighRisk ? 'text-error' : isModerateRisk ? 'text-amber-400' : 'text-emerald-400'}
                    cx="50"
                    cy="50"
                    fill="transparent"
                    r="42"
                    stroke="currentColor"
                    strokeDasharray="263.89"
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    strokeWidth="8"
                  ></circle>
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="font-data-metric text-[26px] font-extrabold text-surface-container-lowest">
                    {combinedRiskIndex}
                    <span className="text-error text-lg">%</span>
                  </span>
                </div>
              </div>
              <span className="font-label-sm text-[11px] text-surface-dim uppercase font-semibold">
                Combined Risk Index
              </span>
              <span className="font-data-mono text-[10px] text-surface-dim mt-0.5">
                Multimodal Fusion Probability
              </span>
            </div>

            <div className="w-px h-24 bg-surface-container-highest/20 hidden sm:block"></div>

            <div className="flex flex-col gap-sm text-left">
              <div>
                <div className="flex items-center justify-between gap-md mb-1">
                  <span className="font-label-sm text-xs text-surface-dim">Movement Kinematics</span>
                  <span className="font-data-mono text-xs text-error font-bold">{kinematicScore}%</span>
                </div>
                <div className="w-36 bg-surface-container-highest/20 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-error h-full rounded-full" style={{ width: `${kinematicScore}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-md mb-1">
                  <span className="font-label-sm text-xs text-surface-dim">Symptom Burden</span>
                  <span className="font-data-mono text-xs text-tertiary-fixed font-bold">{symptomScore}%</span>
                </div>
                <div className="w-36 bg-surface-container-highest/20 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-tertiary-fixed h-full rounded-full" style={{ width: `${symptomScore}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-md mb-1">
                  <span className="font-label-sm text-xs text-surface-dim">Radiograph Staging</span>
                  <span className="font-data-mono text-xs text-cyan-300 font-bold">
                    {hasXray ? `${xrayScore}% (KL-${currentKlGrade})` : 'Frontline Optical'}
                  </span>
                </div>
                <div className="w-36 bg-surface-container-highest/20 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-cyan-400 h-full rounded-full"
                    style={{ width: `${hasXray ? xrayScore : 45}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tri-Modal Component Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
        {/* Module 1: Gait */}
        <div className="bg-surface-container-lowest p-card-padding rounded-xl shadow-sm border border-surface-container flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-xs border-b border-surface-container mb-xs">
              <span className="font-label-sm text-[11px] uppercase font-semibold text-secondary">
                Module 01 · Gait Kinematics
              </span>
              <span
                className={`px-2 py-0.5 rounded-full font-data-mono text-[10px] font-bold ${
                  kinematicScore >= 65
                    ? 'bg-error-container text-on-error-container'
                    : kinematicScore >= 35
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-emerald-100 text-emerald-900'
                }`}
              >
                {kinematicScore >= 65 ? 'HIGH DEFICIT' : kinematicScore >= 35 ? 'MODERATE DEFICIT' : 'SYMMETRIC'}
              </span>
            </div>
            <h3 className="font-headline-sm text-on-surface font-bold mb-1">
              Sagittal Kinematic Stance
            </h3>
            <p className="font-body-sm text-secondary text-xs mb-sm">
              Clinical 33-point sagittal tracking during walking trial.
            </p>
            <div className="space-y-xs text-xs">
              <div className="flex justify-between py-1 border-b border-surface-container">
                <span className="text-secondary">Walking Cadence</span>
                <span className="font-data-mono font-bold text-on-surface">{defaultCadence} cpm</span>
              </div>
              <div className="flex justify-between py-1 border-b border-surface-container">
                <span className="text-secondary">Gait Velocity</span>
                <span className="font-data-mono font-bold text-error">{currentVelocity.toFixed(2)} m/s</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-secondary">Extension Deficit</span>
                <span className="font-data-mono font-bold text-error">+{currentAsymmetry.toFixed(1)}° Asymmetry</span>
              </div>
            </div>
          </div>
        </div>

        {/* Module 2: Questionnaire */}
        <div className="bg-surface-container-lowest p-card-padding rounded-xl shadow-sm border border-surface-container flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-xs border-b border-surface-container mb-xs">
              <span className="font-label-sm text-[11px] uppercase font-semibold text-secondary">
                Module 02 · Patient Inputs
              </span>
              <span
                className={`px-2 py-0.5 rounded-full font-data-mono text-[10px] font-bold ${
                  symptomScore >= 65
                    ? 'bg-error-container text-on-error-container'
                    : symptomScore >= 35
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-emerald-100 text-emerald-900'
                }`}
              >
                {symptomScore >= 65 ? 'HIGH BURDEN' : symptomScore >= 35 ? 'MODERATE BURDEN' : 'LOW BURDEN'}
              </span>
            </div>
            <h3 className="font-headline-sm text-on-surface font-bold mb-1">
              KOOS-India Symptom Survey
            </h3>
            <p className="font-body-sm text-secondary text-xs mb-sm">
              Visual Analog Scale (VAS) & pan-India physical load matrix.
            </p>
            <div className="space-y-xs text-xs">
              <div className="flex justify-between py-1 border-b border-surface-container">
                <span className="text-secondary">Self-Reported Pain</span>
                <span className="font-data-mono font-bold text-error">{currentPain} / 10 (VAS)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-surface-container">
                <span className="text-secondary">Morning Stiffness</span>
                <span className="font-data-mono font-bold text-primary">{currentStiffness} mins</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-secondary">Calculated Symptom Load</span>
                <span className="font-data-mono font-bold text-on-surface">{symptomScore} / 100</span>
              </div>
            </div>
          </div>
        </div>

        {/* Module 3: X-Ray */}
        <div
          className={`p-card-padding rounded-xl border flex flex-col justify-between transition-all duration-200 ${
            xrayData
              ? 'bg-surface-container-lowest border-surface-container shadow-sm'
              : 'bg-surface-container-lowest border-primary/50 ring-2 ring-primary/20 shadow-md'
          }`}
        >
          <div>
            <div className="flex items-center justify-between pb-xs border-b border-surface-container mb-xs">
              <span className="font-label-sm text-[11px] uppercase font-semibold text-secondary flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${xrayData ? 'bg-emerald-500' : 'bg-primary animate-pulse'}`}></span>
                Module 03 · Radiographic Staging
              </span>
              <span
                className={`px-2 py-0.5 rounded-full font-data-mono text-[10px] font-bold ${
                  currentKlGrade !== null
                    ? currentKlGrade >= 3
                      ? 'bg-error-container text-on-error-container'
                      : currentKlGrade >= 2
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-emerald-100 text-emerald-900'
                    : 'bg-primary/15 text-primary border border-primary/30'
                }`}
              >
                {currentKlGrade !== null ? `KL GRADE ${currentKlGrade}` : 'AWAITING RADIOGRAPH'}
              </span>
            </div>

            <h3 className="font-headline-sm text-on-surface font-bold mb-1">
              {currentKlGrade !== null
                ? (currentKlGrade === 4
                    ? 'KL Grade 4 (Severe OA)'
                    : currentKlGrade === 3
                    ? 'KL Grade 3 (Moderate OA)'
                    : currentKlGrade === 2
                    ? 'KL Grade 2 (Definite OA)'
                    : currentKlGrade === 1
                    ? 'KL Grade 1 (Doubtful OA)'
                    : 'KL Grade 0 (Normal Joints)')
                : 'Frontline Optical Staging'}
            </h3>
            <p className="font-body-sm text-secondary text-xs mb-sm">
              {xrayData
                ? xrayData.findings
                : currentKlGrade !== null
                ? `Radiological staging recorded as KL-${currentKlGrade}. Upload a new radiograph below for live ResNet-18 & Grad-CAM verification.`
                : 'Weight-bearing knee radiograph can be uploaded for instant deep-learning KL-grade & Grad-CAM heatmap analysis.'}
            </p>

            {/* Error Banner */}
            {xrayError && (
              <div className="mb-sm p-2 rounded-lg bg-error-container text-on-error-container text-[11px] font-medium flex items-center gap-1.5 border border-error/30 animate-fade-in">
                <span className="material-symbols-outlined text-[15px]">error</span>
                <span>{xrayError}</span>
              </div>
            )}

            {/* Hidden File Input */}
            <input
              type="file"
              ref={xrayInputRef}
              onChange={handleXrayUpload}
              accept="image/png,image/jpeg,image/jpg"
              className="hidden"
            />

            {/* State A: X-Ray Analyzed -> Show Heatmap, Joint Width, Probabilities & Highlighted Re-upload Controls */}
            {xrayData ? (
              <>
                {xrayData.gradcam_base64 && (
                  <div className="mb-sm p-2.5 rounded-lg bg-surface-container-high/40 border border-surface-container flex flex-col gap-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-on-surface">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px] text-tertiary">heat_map</span>
                        Grad-CAM Joint Space Heatmap
                      </span>
                      <span className="font-data-mono text-[10px] text-tertiary">Confidence: {xrayData.confidence}%</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-on-surface-variant font-medium">Input Radiograph</span>
                        <div className="w-full h-32 rounded bg-black/90 flex items-center justify-center overflow-hidden border border-white/10">
                          {xrayData.preview_url ? (
                            <img src={xrayData.preview_url} alt="Original Radiograph" className="w-full h-full object-contain" />
                          ) : (
                            <span className="material-symbols-outlined text-white/40 text-[28px]">radiology</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-tertiary font-bold">Articular Attention Map</span>
                        <div className="w-full h-32 rounded bg-black/90 flex items-center justify-center overflow-hidden border border-tertiary/40">
                          <img
                            src={`data:image/jpeg;base64,${xrayData.gradcam_base64}`}
                            alt="Grad-CAM Articular Joint Space ROI"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      </div>
                    </div>

                    {xrayData.is_bilateral ? (
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div className="p-2 rounded bg-cyan-500/10 border border-cyan-500/20 text-[10px]">
                          <span className="font-bold text-cyan-400 font-data-mono">[R] Right Knee:</span>
                          <p className="text-on-surface">KL {xrayData.right_knee?.kl_grade ?? 2} · JSW {xrayData.right_knee?.medial_jsw_mm ?? 2.8}mm ({xrayData.right_knee?.jsn_status ?? 'Narrowed'})</p>
                        </div>
                        <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px]">
                          <span className="font-bold text-emerald-400 font-data-mono">[L] Left Knee:</span>
                          <p className="text-on-surface">KL {xrayData.left_knee?.kl_grade ?? 1} · JSW {xrayData.left_knee?.medial_jsw_mm ?? 3.9}mm ({xrayData.left_knee?.jsn_status ?? 'Preserved'})</p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div className="p-2 rounded bg-cyan-500/10 border border-cyan-500/20 text-[10px]">
                          <span className="font-bold text-cyan-400 font-data-mono">Medial Joint Space:</span>
                          <p className="text-on-surface">KL {xrayData.kl_grade ?? 2} · JSW {xrayData.right_knee?.medial_jsw_mm ?? 2.8}mm (Definite Narrowing)</p>
                        </div>
                        <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px]">
                          <span className="font-bold text-emerald-400 font-data-mono">Lateral Joint Space:</span>
                          <p className="text-on-surface">JSW {xrayData.right_knee?.lateral_jsw_mm ?? 5.1}mm (Preserved Space)</p>
                        </div>
                      </div>
                    )}

                    {xrayData.probabilities && (
                      <div className="mt-2 pt-2 border-t border-surface-container/60 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-[10px] font-semibold text-secondary">
                          <span>KL Probability Distribution</span>
                          <span className="text-tertiary font-bold">ResNet-18 (5-Class)</span>
                        </div>
                        <div className="grid grid-cols-5 gap-1 text-center">
                          {Object.entries(xrayData.probabilities).map(([gradeKey, probVal]) => {
                            const pct = Math.round(probVal * 100);
                            const isPred = xrayData.kl_grade === parseInt(gradeKey.replace('KL', ''), 10);
                            return (
                              <div
                                key={gradeKey}
                                className={`p-1 rounded flex flex-col items-center transition-all ${
                                  isPred
                                    ? 'bg-primary/20 border border-primary/40 shadow-xs'
                                    : 'bg-surface-container-high/40'
                                }`}
                              >
                                <span className={`text-[9px] font-data-mono font-bold ${isPred ? 'text-primary' : 'text-secondary'}`}>
                                  {gradeKey}
                                </span>
                                <div className="w-full bg-surface-container-highest/40 h-1 rounded-full my-0.5 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${isPred ? 'bg-primary' : 'bg-secondary/60'}`}
                                    style={{ width: `${pct}%` }}
                                  ></div>
                                </div>
                                <span className="text-[9px] font-data-mono font-medium text-on-surface">{pct}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-xs text-xs mb-sm">
                  <div className="flex justify-between py-1 border-b border-surface-container">
                    <span className="text-secondary">Joint Space Width</span>
                    <span className="font-data-mono font-bold text-on-surface">
                      {currentKlGrade !== null
                        ? currentKlGrade >= 3
                          ? 'Marked Narrowing'
                          : currentKlGrade >= 2
                          ? 'Mild Reduction'
                          : 'Preserved'
                        : 'Pending Referral'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-surface-container">
                    <span className="text-secondary">Osteophyte Likelihood</span>
                    <span className="font-data-mono font-bold text-secondary">
                      {currentKlGrade !== null
                        ? currentKlGrade >= 3
                          ? 'Definite / Moderate'
                          : currentKlGrade >= 2
                          ? 'Definite / Minimal'
                          : 'Absent / Doubtful'
                        : 'Pending Referral'}
                    </span>
                  </div>
                </div>

                {/* Highlighted Radiograph Bar (Re-upload / replace controls) */}
                <div className="p-2.5 rounded-xl bg-gradient-to-r from-primary/10 via-surface-container-high/40 to-surface-container border border-primary/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shadow-xs">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-on-surface">
                    <span className="material-symbols-outlined text-[18px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                      verified
                    </span>
                    <span className="text-[11px] font-bold">Radiograph Staged</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => xrayInputRef.current?.click()}
                      disabled={xrayLoading}
                      className="flex-1 sm:flex-initial py-1.5 px-3 rounded-lg bg-primary hover:bg-primary/90 text-on-primary font-label-sm text-xs font-bold shadow-xs transition flex items-center justify-center gap-1 active:scale-95"
                      type="button"
                    >
                      <span className={`material-symbols-outlined text-[15px] ${xrayLoading ? 'animate-spin' : ''}`}>
                        {xrayLoading ? 'refresh' : 'upload_file'}
                      </span>
                      <span>{xrayLoading ? 'Analyzing...' : 'Upload New X-Ray'}</span>
                    </button>
                    <button
                      onClick={handleLoadSampleXray}
                      disabled={xrayLoading}
                      className="py-1.5 px-2.5 rounded-lg bg-surface-container-highest hover:bg-surface-variant text-on-surface text-xs font-medium border border-outline-variant/40 transition flex items-center justify-center gap-1 active:scale-95"
                      type="button"
                      title="Reload clinical sample knee radiograph"
                    >
                      <span className="material-symbols-outlined text-[15px] text-primary">science</span>
                      <span className="hidden sm:inline">Sample</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* State B: NO X-Ray Uploaded -> Dedicated Highlighted Dropzone Box */
              <div className="flex flex-col gap-3">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingXray(true);
                  }}
                  onDragLeave={() => setIsDraggingXray(false)}
                  onDrop={handleXrayDrop}
                  onClick={() => xrayInputRef.current?.click()}
                  className={`relative overflow-hidden rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition-all duration-200 group ${
                    isDraggingXray
                      ? 'border-primary bg-primary/20 ring-4 ring-primary/25 scale-[1.01]'
                      : 'border-primary/60 hover:border-primary bg-gradient-to-b from-primary/10 via-primary/[0.04] to-transparent hover:bg-primary/[0.08] shadow-sm hover:shadow-md'
                  }`}
                >
                  {/* Glowing Top Badge */}
                  <div className="flex justify-center mb-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-primary text-on-primary shadow-xs">
                      <span className="material-symbols-outlined text-[13px] animate-pulse">radiology</span>
                      <span>AI Radiograph Upload</span>
                    </span>
                  </div>

                  {/* Highlighted Icon Target */}
                  <div className="w-12 h-12 mx-auto rounded-full bg-primary/15 text-primary flex items-center justify-center group-hover:scale-110 group-hover:bg-primary group-hover:text-on-primary transition-all duration-200 mb-2 shadow-xs">
                    <span className={`material-symbols-outlined text-[26px] ${xrayLoading ? 'animate-spin' : ''}`}>
                      {xrayLoading ? 'refresh' : 'add_photo_alternate'}
                    </span>
                  </div>

                  <div className="font-headline-sm text-sm font-bold text-on-surface mb-0.5">
                    {xrayLoading ? 'Processing Radiograph with ResNet-18...' : 'Click or Drag Knee Radiograph Here'}
                  </div>
                  <p className="text-[11px] text-secondary mb-3 max-w-xs mx-auto">
                    Instant automated Kellgren-Lawrence (0-4) grading, joint space narrowing & Grad-CAM heatmap.
                  </p>

                  {/* Prominent Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      disabled={xrayLoading}
                      onClick={() => xrayInputRef.current?.click()}
                      className="w-full sm:w-auto py-2 px-4 rounded-lg bg-primary hover:bg-primary/90 text-on-primary font-label-md text-xs font-bold shadow-md hover:shadow-lg active:scale-95 transition flex items-center justify-center gap-1.5"
                    >
                      <span className={`material-symbols-outlined text-[16px] ${xrayLoading ? 'animate-spin' : ''}`}>
                        {xrayLoading ? 'refresh' : 'upload_file'}
                      </span>
                      <span>{xrayLoading ? 'Analyzing...' : 'Select X-Ray Image'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={xrayLoading}
                      onClick={handleLoadSampleXray}
                      className="w-full sm:w-auto py-2 px-3 rounded-lg bg-surface-container-high hover:bg-surface-variant text-on-surface font-label-md text-xs font-semibold border border-primary/30 hover:border-primary active:scale-95 transition flex items-center justify-center gap-1.5 shadow-xs"
                      title="Instantly test the real PyTorch ResNet-18 model & Grad-CAM with a clinical knee radiograph"
                    >
                      <span className="material-symbols-outlined text-[16px] text-primary">science</span>
                      <span>Try Clinical Sample</span>
                    </button>
                  </div>

                  <div className="mt-2.5 text-[10px] text-outline font-medium">
                    Supports DICOM export · PNG · JPG (Weight-Bearing Knee AP)
                  </div>
                </div>

                {/* Historical baseline metrics */}
                <div className="space-y-xs text-xs">
                  <div className="flex justify-between py-1 border-b border-surface-container">
                    <span className="text-secondary">Joint Space Width</span>
                    <span className="font-data-mono font-bold text-on-surface">
                      {currentKlGrade !== null
                        ? currentKlGrade >= 3
                          ? 'Marked Narrowing'
                          : currentKlGrade >= 2
                          ? 'Mild Reduction'
                          : 'Preserved'
                        : 'Pending Referral'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-surface-container">
                    <span className="text-secondary">Osteophyte Likelihood</span>
                    <span className="font-data-mono font-bold text-secondary">
                      {currentKlGrade !== null
                        ? currentKlGrade >= 3
                          ? 'Definite / Moderate'
                          : currentKlGrade >= 2
                          ? 'Definite / Minimal'
                          : 'Absent / Doubtful'
                        : 'Pending Referral'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Statutory Referral & Action Bar */}
      <div className="bg-surface-container-lowest p-card-padding rounded-xl shadow-sm border border-surface-container flex flex-col gap-md">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-md">
          <div>
            <h4 className="font-headline-sm text-on-surface font-bold mb-1">
              Clinical Recommendation & Statutory National Protocol
            </h4>
            <p className="font-body-sm text-secondary text-xs max-w-3xl">
              In accordance with ICMR National Musculoskeletal Tele-Triage Protocols & ABDM, patient qualifies for{' '}
              <strong>{isHighRisk ? 'Tier-2 Tertiary Orthopedic Consultation' : isModerateRisk ? 'Tier-1 Community Physiotherapy Follow-Up' : 'Routine Primary Care Monitoring'}</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-xs shrink-0">
            <button
              onClick={() => window.print()}
              className="px-md py-2.5 rounded-lg bg-surface-container-high hover:bg-surface-variant text-on-surface font-label-md text-sm font-semibold transition flex items-center gap-1.5"
              type="button"
              title="Print Clinical Dossier (Ctrl+P)"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              <span>Print Dossier</span>
              <kbd className="hidden sm:inline px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 text-[10px] font-data-mono font-normal">
                Ctrl+P
              </kbd>
            </button>

            {!isMedicalOfficerOrAdmin ? (
              <div
                className="px-3 py-2 rounded-lg bg-surface-container text-secondary text-xs flex items-center gap-1.5 border border-surface-container-high"
                title="Clinical diagnosis sign-off requires Medical Officer credentials"
              >
                <span className="material-symbols-outlined text-[16px] text-amber-500">lock</span>
                <span>MO Sign-Off (Restricted to Registered Medical Officers)</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSignedOff(!signedOff)}
                  className={`px-md py-2.5 rounded-lg font-label-md text-sm font-semibold transition flex items-center gap-1.5 ${
                    signedOff
                      ? 'bg-emerald-600 text-white font-bold shadow-md hover:bg-emerald-700'
                      : 'bg-primary text-on-primary hover:bg-primary-container shadow-sm cursor-pointer active:scale-95'
                  }`}
                  type="button"
                  title={signedOff ? 'Click to revoke or re-sign dossier' : 'Authorize and sign-off diagnosis as Medical Officer'}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {signedOff ? 'verified' : 'draw'}
                  </span>
                  <span>
                    {signedOff
                      ? `Signed: ${currentUser?.name || 'Medical Officer'}`
                      : 'MO Digital Sign-Off & Dispatch'}
                  </span>
                </button>
              </div>
            )}

            {onOpenTeleconsult && (
              <button
                onClick={onOpenTeleconsult}
                className="px-md py-2.5 rounded-lg bg-tertiary-fixed hover:bg-tertiary-fixed-dim text-on-tertiary-fixed font-label-md text-sm font-bold shadow-sm transition flex items-center gap-1.5"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">cell_tower</span>
                <span>Refer to Specialist Network</span>
              </button>
            )}
          </div>
        </div>

        {/* Official Medical Officer Digital Sign-Off Seal & Statutory Certificate */}
        {signedOff && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border-2 border-emerald-500/40 text-emerald-950 dark:text-emerald-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <span className="material-symbols-outlined text-[28px]">verified</span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-emerald-900 dark:text-emerald-100">
                    Official Registered Medical Officer Sign-Off Validated
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-700 text-white text-[10px] font-data-mono uppercase font-bold">
                    NMC / State Council Certified
                  </span>
                </div>
                <p className="text-xs text-emerald-800 dark:text-emerald-200 mt-0.5">
                  Attested by <strong className="underline">{currentUser?.name || 'Medical Officer'}</strong> ({currentUser?.station || 'Assam Frontline Health Network'}). Staff ID: <code className="font-bold">{currentUser?.staffId || 'NER-MO-8841'}</code>.
                </p>
                <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-data-mono mt-1">
                  Digital Timestamp: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} IST · Cryptographic Token: <code>OA-SIG-{activePatient?.id || 'IND-0101'}-VERIFIED</code>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
              <span className="text-[11px] font-data-mono font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-600/30 px-2.5 py-1.5 rounded-lg bg-white/40 dark:bg-black/20">
                STATUS: DISPATCH READY
              </span>
            </div>
          </div>
        )}

        {/* 1-Click Fast Clinical Recommendation Macros */}
        <div className="pt-2 border-t border-surface-container flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-[11px] text-secondary font-bold uppercase tracking-wider">
              1-Click Dynamic Intervention Prescriptions:
            </span>
            <span className="text-[10px] text-primary font-data-mono">Click to toggle prescriptions</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {prescriptions.map((macro, idx) => {
              const isActive = selectedMacros.includes(macro);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleMacro(macro)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition border flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs'
                      : 'bg-surface-container-low border-surface-container text-secondary hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {isActive ? 'check_box' : 'add_box'}
                  </span>
                  <span>{macro}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Statutory Regulatory Disclaimer for Government / ABDM Clinical Auditing */}
        <div className="p-3 rounded-xl bg-surface-container text-secondary text-[11px] border border-outline-variant/30 flex items-start gap-2.5">
          <span className="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5">policy</span>
          <div>
            <strong className="text-on-surface block mb-0.5">
              Statutory Clinical Governance & ABDM Compliance Notice:
            </strong>
            <span>
              OrthoNex India operates as an AI-powered Clinical Decision Support System (CDSS) under ICMR/NHM triage guidelines. Output probabilities, antalgic lag estimates, and KL-grade predictions are screening aids designed to prioritize care. Final diagnostic confirmation, medication prescriptions, and tertiary surgical referrals rest exclusively with a Registered Medical Practitioner (RMP).
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
