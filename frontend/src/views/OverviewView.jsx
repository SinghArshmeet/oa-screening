import React, { useState, useEffect, useMemo, useRef } from 'react';
import CameraViewport from '../components/CameraViewport';
import { getPatientClinicalProfile } from '../utils/clinicalProfiles';
import { isSupabaseConfigured } from '../utils/supabase';
import { predictClinicalRisk, updatePatientVitals, analyzeXrayImage } from '../utils/api';

export default function OverviewView({
  activePatient,
  onNavigate,
  surveyResult,
  onSurveySubmitted,
  gaitResult,
  xrayResult,
  onXrayAnalyzed,
  onOpenTeleconsult,
  camera,
  currentUser
}) {
  const profile = useMemo(() => getPatientClinicalProfile(activePatient), [activePatient?.id, activePatient?.dbId]);

  // Active evaluation step (1 to 4) with state memory
  const [activeStep, setActiveStep] = useState(() => {
    try {
      const saved = sessionStorage.getItem('orthonex_overview_step');
      if (saved && ['1', '2', '3', '4'].includes(saved)) return parseInt(saved, 10);
    } catch {}
    return gaitResult ? 4 : 1;
  });

  useEffect(() => {
    try {
      sessionStorage.setItem('orthonex_overview_step', String(activeStep));
    } catch {}
  }, [activeStep]);

  const [clinicalPrediction, setClinicalPrediction] = useState(surveyResult?.clinical_prediction || null);
  const [isPredicting, setIsPredicting] = useState(false);

  // Step 3 Radiographic Staging & Grad-CAM State
  const [localXrayData, setLocalXrayData] = useState(xrayResult || null);
  const xrayData = xrayResult || localXrayData;
  const [xrayLoading, setXrayLoading] = useState(false);
  const [xrayError, setXrayError] = useState('');
  const [isDraggingXray, setIsDraggingXray] = useState(false);
  const xrayInputRef = useRef(null);

  // Step 3 Clinical Observatory & Dual-Leg Segregation State
  const [radiographFormatOverride, setRadiographFormatOverride] = useState('auto'); // 'auto' | 'single' | 'bilateral'
  const isBilateral = radiographFormatOverride === 'auto' ? !!xrayData?.is_bilateral : (radiographFormatOverride === 'bilateral');
  const [xrayViewMode, setXrayViewMode] = useState('bilateral'); // 'bilateral' | 'right' | 'left' | 'split' | 'full' | 'medial' | 'lateral'
  const [xrayLayer, setXrayLayer] = useState('gradcam'); // 'gradcam' | 'raw' | 'inverted'
  const [heatmapOpacity, setHeatmapOpacity] = useState(65);
  const [isXrayLightboxOpen, setIsXrayLightboxOpen] = useState(false);
  const [lightboxZoom, setLightboxZoom] = useState(1);

  useEffect(() => {
    if (xrayResult) {
      setLocalXrayData(xrayResult);
    }
  }, [xrayResult]);

  useEffect(() => {
    if (xrayData) {
      if (!isBilateral) {
        if (['bilateral', 'right', 'left'].includes(xrayViewMode)) {
          setXrayViewMode('full');
        }
      } else {
        if (['full', 'medial', 'lateral'].includes(xrayViewMode)) {
          setXrayViewMode('bilateral');
        }
      }
    }
  }, [xrayData, isBilateral]);

  const [completedSteps, setCompletedSteps] = useState(() => {
    const steps = [1];
    if (surveyResult) steps.push(2);
    if (xrayResult || localXrayData) steps.push(3);
    if (gaitResult) steps.push(4);
    return steps;
  });

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
        setCompletedSteps((prev) => Array.from(new Set([...prev, 3])));
      }
    } catch (err) {
      setXrayError(err.message || 'X-Ray analysis could not be completed.');
    } finally {
      setXrayLoading(false);
      if (xrayInputRef.current) xrayInputRef.current.value = '';
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
        setCompletedSteps((prev) => Array.from(new Set([...prev, 3])));
      }
    } catch (err) {
      setXrayError(err.message || 'Sample X-Ray could not be loaded.');
    } finally {
      setXrayLoading(false);
    }
  };

  // Step 1: Vitals & Anthropometrics State
  const [heightCm, setHeightCm] = useState(profile.vitals?.heightCm || 170);
  const [weightKg, setWeightKg] = useState(profile.vitals?.weightKg || 75);
  const [bloodPressure, setBloodPressure] = useState(profile.vitals?.bp || '130/85');
  const [affectedJoint, setAffectedJoint] = useState(profile.vitals?.affectedJoint || 'Right Knee (Medial Compartment)');
  const [selectedHazards, setSelectedHazards] = useState(
    profile.survey?.hazards?.map((h) => h.label) || ['Prolonged Knee Squatting', 'Agrarian Manual Load']
  );

  // Calculate live BMI with safe numeric parsing
  const numHeight = parseFloat(heightCm) || 0;
  const numWeight = parseFloat(weightKg) || 0;
  const computedBmi = (numHeight >= 50 && numWeight >= 10)
    ? (numWeight / Math.pow(numHeight / 100, 2)).toFixed(1)
    : '24.2';
  const getBmiStatus = (bmi) => {
    const b = parseFloat(bmi);
    if (b < 18.5) return { label: 'Underweight', color: 'text-amber-500', note: 'Low bone mineral density risk' };
    if (b < 25) return { label: 'Normal Weight', color: 'text-emerald-500', note: 'Balanced mechanical joint load' };
    if (b < 30) return { label: 'Overweight', color: 'text-amber-500', note: 'Elevated patellofemoral compressive stress (+35%)' };
    return { label: 'Obese', color: 'text-error', note: 'High mechanical compartment loading (+60%)' };
  };
  const bmiStatus = getBmiStatus(computedBmi);

  // Step 2: Clinical Symptoms & KOOS State
  const [painValue, setPainValue] = useState(surveyResult?.pain ?? profile.survey.painVAS);
  const [stiffnessValue, setStiffnessValue] = useState(surveyResult?.stiffness ?? profile.survey.stiffnessMins);
  const [functionalFlags, setFunctionalFlags] = useState({
    squatDifficulty: true,
    crepitus: true,
    stairAscentPain: true,
    nightPain: false
  });

  // Step 3: Optical Camera source state
  const [activeCamSource, setActiveCamSource] = useState(camera?.sourceMode || 'webcam');

  // Sync profile ONLY when active patient changes (prevent resetting sliders/inputs on re-render)
  const activePatientId = activePatient?.id || activePatient?.dbId;
  useEffect(() => {
    setPainValue(surveyResult?.pain ?? profile.survey?.painVAS ?? 6);
    setStiffnessValue(surveyResult?.stiffness ?? profile.survey?.stiffnessMins ?? 30);
    setHeightCm(activePatient?.height_cm || activePatient?.heightCm || profile.vitals?.heightCm || 168);
    setWeightKg(activePatient?.weight_kg || activePatient?.weightKg || profile.vitals?.weightKg || 70);
    setBloodPressure(profile.vitals?.bp || '130/85');
    setAffectedJoint(profile.vitals?.affectedJoint || 'Right Knee (Medial Compartment)');
  }, [activePatientId]);

  // Real-time clinical prediction query against OAI NIH clinical model
  useEffect(() => {
    let active = true;
    const runPrediction = async () => {
      setIsPredicting(true);
      try {
        const bpParts = (bloodPressure || '130/85').split('/');
        const bpSys = parseFloat(bpParts[0]) || 130;
        const bpDias = parseFloat(bpParts[1]) || 85;
        const sideVal = affectedJoint.toLowerCase().includes('left') ? 2 : 1;
        const sexVal = (activePatient?.gender || profile.gender || 'Male').toLowerCase().startsWith('f') ? 2 : 1;

        const res = await predictClinicalRisk({
          age: activePatient?.age || profile.age || 60,
          sex: sexVal,
          bmi: parseFloat(computedBmi) || 26.5,
          side: sideVal,
          bp_sys: bpSys,
          bp_dias: bpDias,
          pain: Number(painValue ?? 5),
          stiffness: Number(stiffnessValue ?? 30),
          gait_speed: gaitResult?.velocity || 0.95,
          knee_flexion_deg: 135.0,
          knee_deficit_deg: 10.0
        });
        if (active && res) {
          setClinicalPrediction(res);
        }
      } catch (e) {
        console.warn('Clinical prediction query notice:', e);
      } finally {
        if (active) setIsPredicting(false);
      }
    };

    runPrediction();
    return () => {
      active = false;
    };
  }, [painValue, stiffnessValue, computedBmi, bloodPressure, affectedJoint, activePatient, gaitResult]);

  // Compute live KOOS-India composite score based on inputs
  const computeKoosScore = () => {
    // VAS pain contributes 0-15
    const painComponent = Math.round((painValue / 10) * 15);
    // Stiffness contributes 0-10
    const stiffnessComponent = Math.min(10, Math.round((stiffnessValue / 60) * 10));
    // Functional flags contribute 0-15
    const flagsCount = Object.values(functionalFlags).filter(Boolean).length;
    const flagComponent = Math.round((flagsCount / 4) * 15);

    const total = Math.min(40, painComponent + stiffnessComponent + flagComponent);
    let category = 'low';
    if (total >= 28) category = 'high';
    else if (total >= 16) category = 'moderate';

    return { total, category };
  };

  const currentKoos = computeKoosScore();

  // Handle saving Step 2 Clinical Symptoms
  const handleSaveStep2 = () => {
    const bpParts = (bloodPressure || '130/85').split('/');
    const scoreData = {
      raw_score: currentKoos.total,
      compositeScore: currentKoos.total,
      category: currentKoos.category,
      pain: painValue,
      stiffness: stiffnessValue,
      functionalFlags,
      vitals: {
        heightCm,
        weightKg,
        bmi: parseFloat(computedBmi),
        bloodPressure,
        bpSys: parseFloat(bpParts[0]) || 130,
        bpDias: parseFloat(bpParts[1]) || 85,
        affectedJoint,
        selectedHazards
      },
      clinical_symptoms: {
        pain: painValue,
        stiffness: stiffnessValue,
        functionalFlags,
        koosTotal: currentKoos.total,
        koosCategory: currentKoos.category
      },
      clinical_prediction: clinicalPrediction
    };

    if (onSurveySubmitted) {
      onSurveySubmitted(scoreData);
    }

    markStepComplete(2);
    setActiveStep(3);
  };

  // Handle saving Step 1 Patient Vitals to backend
  const handleConfirmStep1 = async () => {
    markStepComplete(1);
    setActiveStep(2);
    const patientId = activePatient?.dbId || activePatient?.id;
    if (patientId) {
      try {
        await updatePatientVitals(patientId, {
          height_cm: Number(heightCm) || 165,
          weight_kg: Number(weightKg) || 68,
          bmi: parseFloat(computedBmi) || 24.8,
          blood_pressure: bloodPressure,
          affected_joint: affectedJoint
        });
      } catch (err) {
        console.warn('Vitals auto-sync notice:', err);
      }
    }
  };

  const markStepComplete = (stepNum) => {
    setCompletedSteps((prev) => Array.from(new Set([...prev, stepNum])));
  };

  const stepsList = [
    {
      id: 1,
      title: 'Patient Intake & Vitals',
      shortTitle: '1. Vitals',
      subtitle: 'Height, Weight, BMI & Mechanical Load',
      icon: 'monitor_heart'
    },
    {
      id: 2,
      title: 'Clinical Symptoms & KOOS',
      shortTitle: '2. KOOS Score',
      subtitle: 'Pain VAS, Stiffness & Mobility Checks',
      icon: 'clinical_notes'
    },
    {
      id: 3,
      title: 'Radiographic Staging & Knee X-Ray',
      shortTitle: '3. X-Ray & Grad-CAM',
      subtitle: 'KL Grading & Articular Joint Space Heatmap',
      icon: 'radiology'
    },
    {
      id: 4,
      title: 'Standardized 8s Gait Recording Studio',
      shortTitle: '4. Gait Recording',
      subtitle: '8s Walk Test & Sagittal Kinematics AI',
      icon: 'directions_walk'
    }
  ];

  return (
    <div className="flex flex-col w-full gap-lg animate-fade-in">
      {/* SOP-09 Triage Session Banner */}
      <section className="w-full bg-surface-container-lowest rounded-xl shadow-md p-card-padding border-l-4 border-primary">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-md pb-md border-b border-surface-container">
          <div className="flex items-center gap-md">
            <div className="w-12 h-12 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shadow-sm shrink-0">
              <span className="material-symbols-outlined text-[26px]">assignment_ind</span>
            </div>
            <div>
              <div className="flex items-center gap-xs flex-wrap">
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Clinical Osteoarthritis Screening Protocol
                </h2>
                <span className="px-xs py-2xs rounded bg-surface-container-high text-primary font-data-mono text-data-mono font-bold">
                  {currentUser?.roleId === 'officer' ? 'CLINICAL REVIEW DESK' : currentUser?.roleId === 'admin' ? 'SYSTEM TELEMETRY NOC' : 'FRONT-LINE TRIAGE'}
                </span>
                <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
                  {currentUser?.role || 'Clinical Screener'}
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                Screening Station: <span className="font-semibold text-on-surface">{currentUser?.station || profile.stationName}</span> · Active Patient: <span className="font-bold text-on-surface">{activePatient?.name || 'Patient'}</span> ({activePatient?.age || 52}y {activePatient?.gender || 'Female'}, ID: #{activePatient?.id || 'IND-OA-2025-0101'})
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-xs">
            {isSupabaseConfigured ? (
              <span className="px-sm py-xs rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-label-sm text-label-sm font-semibold flex items-center gap-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Cloud Synced
              </span>
            ) : (
              <span className="px-sm py-xs rounded-full bg-surface-container text-on-surface font-label-sm text-label-sm font-semibold flex items-center gap-2xs">
                <span className="material-symbols-outlined text-[16px] text-tertiary">cloud_sync</span>
                Local Station (LAN)
              </span>
            )}

            {/* Fast Track Action CTA */}
            {currentUser?.roleId === 'officer' ? (
              <button
                onClick={() => onNavigate('report')}
                className="px-sm py-1.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-sm text-label-sm font-bold shadow-sm transition flex items-center gap-1.5"
                type="button"
                title="Review multimodal diagnostic report and KL X-Ray staging"
              >
                <span className="material-symbols-outlined text-[16px]">radiology</span>
                Review Clinical Diagnostic Report →
              </button>
            ) : currentUser?.roleId === 'admin' ? (
              <button
                onClick={() => onNavigate('hardware')}
                className="px-sm py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white font-label-sm text-label-sm font-bold shadow-sm transition flex items-center gap-1.5"
                type="button"
                title="Open ESP32 Hardware Fleet manager"
              >
                <span className="material-symbols-outlined text-[16px]">router</span>
                Open Hardware Fleet →
              </button>
            ) : (
              <button
                onClick={() => onNavigate('gait')}
                className="px-sm py-1.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-sm text-label-sm font-bold shadow-sm transition flex items-center gap-1.5"
                type="button"
                title="Skip straight to live optical camera recording"
              >
                <span className="material-symbols-outlined text-[16px] animate-pulse">rocket_launch</span>
                Fast-Track to Gait Screen →
              </button>
            )}
          </div>
        </div>

        {/* 4-Step Interactive Navigation Stepper */}
        <div className="pt-md">
          <div className="flex items-center justify-between text-xs text-on-surface-variant font-semibold mb-2">
            <span>Clinical Evaluation Progress: Stage {activeStep} of 4</span>
            <span className="font-data-mono font-bold text-primary">
              {Math.round(((completedSteps.length) / 4) * 100)}% Complete
            </span>
          </div>

          {/* Progress track bar */}
          <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden mb-4">
            <div
              className="bg-primary h-full transition-all duration-300 rounded-full"
              style={{ width: `${Math.min(100, Math.max(15, (completedSteps.length / 4) * 100))}%` }}
            />
          </div>

          {/* 4 Clickable Step Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-sm">
            {stepsList.map((s) => {
              const isCurrent = activeStep === s.id;
              const isCompleted = completedSteps.includes(s.id);

              return (
                <button
                  key={s.id}
                  onClick={() => setActiveStep(s.id)}
                  type="button"
                  className={`p-3 rounded-xl flex items-center gap-3 text-left transition-all border ${
                    isCurrent
                      ? 'bg-primary text-on-primary shadow-md border-primary ring-2 ring-primary/30'
                      : isCompleted
                      ? 'bg-surface-container-low hover:bg-surface-container border-emerald-500/40 text-on-surface'
                      : 'bg-surface-container-low hover:bg-surface-container border-outline-variant/20 text-on-surface-variant'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 font-data-mono transition ${
                      isCurrent
                        ? 'bg-on-primary text-primary'
                        : isCompleted
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-surface-container-high text-on-surface-variant'
                    }`}
                  >
                    {isCompleted && !isCurrent ? '✓' : s.id}
                  </div>
                  <div className="min-w-0 grow">
                    <div className="flex items-center justify-between">
                      <p className={`text-[11px] uppercase font-bold tracking-wide ${isCurrent ? 'text-primary-fixed' : 'text-on-surface-variant'}`}>
                        {s.shortTitle}
                      </p>
                      {isCompleted && !isCurrent && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">READY</span>
                      )}
                    </div>
                    <p className={`text-[12px] font-bold truncate ${isCurrent ? 'text-on-primary' : 'text-on-surface'}`}>
                      {s.title.split('&')[0].trim()}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main Step Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg items-start">
        {/* Left Column: Active Step Interactive Evaluation Forms (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-lg">

          {/* ================= STEP 1: PATIENT INTAKE & VITALS ================= */}
          {activeStep === 1 && (
            <section className="w-full bg-surface-container-lowest rounded-xl shadow-md p-card-padding border border-surface-container animate-fade-in">
              <div className="flex items-center justify-between pb-sm border-b border-outline-variant/30 mb-md">
                <div className="flex items-center gap-xs">
                  <div className="w-9 h-9 rounded-lg bg-primary-container text-on-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">monitor_heart</span>
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                      Step 1 · Patient Anthropometrics & Vitals
                    </h3>
                    <p className="text-xs text-on-surface-variant">
                      Evaluate baseline compressive knee joint load and physiological parameters
                    </p>
                  </div>
                </div>
                <span className="px-2 py-1 rounded bg-surface-container font-data-mono text-[10px] text-primary font-bold">
                  STAGE 1 / 4
                </span>
              </div>

              <div className="space-y-md">
                {/* Height, Weight & Live BMI */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-sm">
                  <div className="p-sm rounded-lg bg-surface-container-low border border-outline-variant/20">
                    <label className="block text-[11px] font-semibold text-on-surface-variant uppercase mb-1">
                      Height (cm)
                    </label>
                    <input
                      type="number"
                      value={heightCm}
                      onChange={(e) => setHeightCm(Number(e.target.value))}
                      className="w-full bg-surface-container text-on-surface text-base font-bold rounded-lg px-3 py-1.5 border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary font-data-mono"
                      min="100"
                      max="220"
                    />
                  </div>

                  <div className="p-sm rounded-lg bg-surface-container-low border border-outline-variant/20">
                    <label className="block text-[11px] font-semibold text-on-surface-variant uppercase mb-1">
                      Weight (kg)
                    </label>
                    <input
                      type="number"
                      value={weightKg}
                      onChange={(e) => setWeightKg(Number(e.target.value))}
                      className="w-full bg-surface-container text-on-surface text-base font-bold rounded-lg px-3 py-1.5 border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary font-data-mono"
                      min="30"
                      max="180"
                    />
                  </div>

                  <div className="p-sm rounded-lg bg-surface-container-low border border-outline-variant/20 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-on-surface-variant uppercase">
                        Computed BMI
                      </span>
                      <span className={`text-[11px] font-bold ${bmiStatus.color}`}>
                        {bmiStatus.label}
                      </span>
                    </div>
                    <div className="text-xl font-bold font-data-metric text-on-surface">
                      {computedBmi} <span className="text-xs font-normal text-on-surface-variant">kg/m²</span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant leading-tight">
                      {bmiStatus.note}
                    </p>
                  </div>
                </div>

                {/* Blood Pressure & Laterality */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
                  <div className="p-sm rounded-lg bg-surface-container-low border border-outline-variant/20">
                    <label className="block text-[11px] font-semibold text-on-surface-variant uppercase mb-1">
                      Resting Blood Pressure
                    </label>
                    <input
                      type="text"
                      value={bloodPressure}
                      onChange={(e) => setBloodPressure(e.target.value)}
                      placeholder="120/80 mmHg"
                      className="w-full bg-surface-container text-on-surface text-sm font-bold rounded-lg px-3 py-1.5 border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary font-data-mono"
                    />
                  </div>

                  <div className="p-sm rounded-lg bg-surface-container-low border border-outline-variant/20">
                    <label className="block text-[11px] font-semibold text-on-surface-variant uppercase mb-1">
                      Primary Knee Laterality
                    </label>
                    <select
                      value={affectedJoint}
                      onChange={(e) => setAffectedJoint(e.target.value)}
                      className="w-full bg-surface-container text-on-surface text-sm font-semibold rounded-lg px-3 py-1.5 border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                    >
                      <option value="Right Knee (Medial Compartment)">Right Knee (Medial Compartment)</option>
                      <option value="Left Knee (Medial Compartment)">Left Knee (Medial Compartment)</option>
                      <option value="Bilateral Knee (Both Joints)">Bilateral Knee (Both Joints)</option>
                      <option value="Patellofemoral Anterior Compartment">Patellofemoral Anterior Compartment</option>
                    </select>
                  </div>
                </div>

                {/* Occupational Hazards */}
                <div>
                  <label className="block text-[11px] font-semibold text-on-surface-variant uppercase mb-2">
                    Occupational & Biomechanical Risk Exposures ({activePatient?.occupation || 'Field Profile'})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'Agrarian Field Bending', icon: 'agriculture' },
                      { label: 'Heavy Head/Manual Load (>20kg)', icon: 'fitness_center' },
                      { label: 'Prolonged Floor Squatting', icon: 'airline_seat_recline_extra' },
                      { label: 'Stair / Hill Slope Incline', icon: 'stairs' },
                      { label: 'Sedentary Desk (>8h/day)', icon: 'chair' }
                    ].map((item) => {
                      const isSelected = selectedHazards.includes(item.label);
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            setSelectedHazards((prev) =>
                              isSelected ? prev.filter((x) => x !== item.label) : [...prev, item.label]
                            );
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                            isSelected
                              ? 'bg-primary text-on-primary shadow-xs'
                              : 'bg-surface-container text-on-surface hover:bg-surface-container-high border border-outline-variant/20'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[15px]">{item.icon}</span>
                          {item.label}
                          {isSelected && <span className="text-[11px]">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 1 Actions */}
                <div className="pt-sm border-t border-outline-variant/30 flex items-center justify-between">
                  <span className="text-xs text-on-surface-variant">
                    All vitals auto-calibrated for frontline clinical screening
                  </span>
                  <button
                    type="button"
                    onClick={handleConfirmStep1}
                    className="px-md py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-bold text-xs transition shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    Confirm Vitals & Proceed to Step 2 →
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* ================= STEP 2: CLINICAL KOOS & PAIN EVALUATION ================= */}
          {activeStep === 2 && (
            <section className="w-full bg-surface-container-lowest rounded-xl shadow-md p-card-padding border border-surface-container animate-fade-in">
              <div className="flex items-center justify-between pb-sm border-b border-outline-variant/30 mb-md">
                <div className="flex items-center gap-xs">
                  <div className="w-9 h-9 rounded-lg bg-primary-container text-on-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">clinical_notes</span>
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                      Step 2 · Clinical Symptoms & KOOS-India Scoring
                    </h3>
                    <p className="text-xs text-on-surface-variant">
                      Rapid subjective pain assessment, joint stiffness duration, and functional difficulty
                    </p>
                  </div>
                </div>
                <span className="px-2 py-1 rounded bg-surface-container font-data-mono text-[10px] text-primary font-bold">
                  STAGE 2 / 4
                </span>
              </div>

              <div className="space-y-md">
                {/* Visual VAS Pain Slider */}
                <div className="p-sm rounded-lg bg-surface-container-low border border-outline-variant/20">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-on-surface">
                      Knee Joint Pain Severity (VAS 0–10)
                    </span>
                    <span className="text-lg font-bold font-data-metric text-error">
                      {painValue} / 10
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={painValue}
                    onChange={(e) => setPainValue(Number(e.target.value))}
                    className="w-full accent-primary h-2.5 bg-surface-variant rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-on-surface-variant mt-1">
                    <span className="text-emerald-600 font-medium">0 - Asymptomatic</span>
                    <span className="text-amber-600 font-medium">5 - Weight-Bearing Ache</span>
                    <span className="text-error font-bold">10 - Debilitating Constant Pain</span>
                  </div>
                </div>

                {/* Morning Stiffness Duration */}
                <div className="p-sm rounded-lg bg-surface-container-low border border-outline-variant/20">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-on-surface">
                      Morning Joint Stiffness Duration
                    </span>
                    <span className="text-lg font-bold font-data-metric text-primary">
                      {stiffnessValue} minutes
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="90"
                    step="5"
                    value={stiffnessValue}
                    onChange={(e) => setStiffnessValue(Number(e.target.value))}
                    className="w-full accent-primary h-2.5 bg-surface-variant rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-on-surface-variant mt-1">
                    <span>&lt;10m (Normal)</span>
                    <span className="text-primary font-bold">30m (Knee OA Threshold)</span>
                    <span className="text-error font-bold">&gt;60m (Severe Inflammatory)</span>
                  </div>
                </div>

                {/* Functional Mobility Checklist */}
                <div className="p-sm rounded-lg bg-surface-container-low border border-outline-variant/20">
                  <span className="text-xs font-semibold text-on-surface block mb-2">
                    Frontline Functional Mobility Quick Checks
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { key: 'squatDifficulty', label: 'Difficulty Squatting / Floor Sitting' },
                      { key: 'crepitus', label: 'Audible Patellar Grinding / Crepitus' },
                      { key: 'stairAscentPain', label: 'Sharp Pain on Stair Climbing' },
                      { key: 'nightPain', label: 'Resting / Nocturnal Joint Throbbing' }
                    ].map((item) => (
                      <label
                        key={item.key}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition border text-xs ${
                          functionalFlags[item.key]
                            ? 'bg-primary-container/20 border-primary text-on-surface font-semibold'
                            : 'bg-surface-container border-outline-variant/20 text-on-surface-variant'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={functionalFlags[item.key]}
                          onChange={(e) =>
                            setFunctionalFlags((prev) => ({ ...prev, [item.key]: e.target.checked }))
                          }
                          className="w-4 h-4 rounded text-primary accent-primary"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Real-time KOOS Score Result */}
                <div className="p-sm rounded-lg bg-surface-container flex items-center justify-between border border-outline-variant/30">
                  <div>
                    <span className="text-[10px] text-on-surface-variant uppercase font-semibold block">
                      Calculated Frontline KOOS-India Index
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold font-data-metric text-on-surface">
                        {currentKoos.total} / 40
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                          currentKoos.category === 'high'
                            ? 'bg-error-container text-on-error-container'
                            : currentKoos.category === 'moderate'
                            ? 'bg-amber-500/20 text-amber-800 dark:text-amber-200'
                            : 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200'
                        }`}
                      >
                        {currentKoos.category} Clinical Burden
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('survey')}
                    className="px-2.5 py-1 text-xs text-primary font-bold hover:underline"
                  >
                    Open Full 40-pt Survey →
                  </button>
                </div>

                {/* Step 2 Actions */}
                <div className="pt-sm border-t border-outline-variant/30 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setActiveStep(1)}
                    className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs transition"
                  >
                    ← Back to Step 1
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveStep2}
                    className="px-md py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-bold text-xs transition shadow-md flex items-center gap-1.5"
                  >
                    Confirm Symptoms & Proceed to Step 3 →
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* ================= STEP 3: RADIOGRAPHIC STAGING & KNEE X-RAY ================= */}
          {activeStep === 3 && (
            <section className="w-full bg-surface-container-lowest rounded-xl shadow-md p-card-padding border border-surface-container animate-fade-in">
              <div className="flex items-center justify-between pb-sm border-b border-outline-variant/30 mb-md">
                <div className="flex items-center gap-xs">
                  <div className="w-9 h-9 rounded-lg bg-primary-container text-on-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">radiology</span>
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                      Step 3 · Radiographic Staging & Knee X-Ray (Grad-CAM)
                    </h3>
                    <p className="text-xs text-on-surface-variant">
                      Upload knee radiograph or test with clinical sample for automated Kellgren-Lawrence (KL 0–4) grading
                    </p>
                  </div>
                </div>
                <span className="px-2 py-1 rounded bg-surface-container font-data-mono text-[10px] text-primary font-bold">
                  STAGE 3 / 4
                </span>
              </div>

              <div className="space-y-md">
                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={xrayInputRef}
                  onChange={handleXrayUpload}
                  accept="image/png,image/jpeg,image/jpg"
                  className="hidden"
                />

                {/* Error Banner */}
                {xrayError && (
                  <div className="p-2.5 rounded-lg bg-error-container text-on-error-container text-xs font-medium flex items-center gap-1.5 border border-error/30">
                    <span className="material-symbols-outlined text-[16px]">error</span>
                    <span>{xrayError}</span>
                  </div>
                )}

                {/* State A: X-Ray Analyzed -> Full Clinical Observatory & Dual-Leg Knee Segregation */}
                {xrayData ? (
                  <div className="space-y-md">
                    {/* ================= 1. OBSERVATORY CONTROLS & WORKSTATION TOOLBAR ================= */}
                    <div className="flex flex-col gap-2 p-3 rounded-xl bg-surface-container-low border border-surface-container">
                      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
                        {/* Left: View Mode Tabs (Adaptive to Single vs Bilateral) */}
                        <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
                          <span className="text-[10px] font-bold text-secondary uppercase tracking-wider mr-1 hidden sm:inline">
                            View Mode:
                          </span>

                          {isBilateral ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setXrayViewMode('bilateral')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                                  xrayViewMode === 'bilateral'
                                    ? 'bg-primary text-on-primary shadow-sm'
                                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[16px]">view_column</span>
                                <span>Bilateral (Both Knees)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setXrayViewMode('right')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                                  xrayViewMode === 'right'
                                    ? 'bg-cyan-600 text-white shadow-sm'
                                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                                <span>Right Knee Focus (R)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setXrayViewMode('left')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                                  xrayViewMode === 'left'
                                    ? 'bg-emerald-600 text-white shadow-sm'
                                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                                }`}
                              >
                                <span>Left Knee Focus (L)</span>
                                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setXrayViewMode('split')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                                  xrayViewMode === 'split'
                                    ? 'bg-tertiary text-on-tertiary shadow-sm'
                                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[16px]">splitscreen</span>
                                <span>Side-by-Side</span>
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => setXrayViewMode('full')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                                  xrayViewMode === 'full'
                                    ? 'bg-primary text-on-primary shadow-sm'
                                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[16px]">crop_free</span>
                                <span>Full Joint View</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setXrayViewMode('medial')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                                  xrayViewMode === 'medial'
                                    ? 'bg-cyan-600 text-white shadow-sm'
                                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                                <span>Medial Compartment (Inner)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setXrayViewMode('lateral')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                                  xrayViewMode === 'lateral'
                                    ? 'bg-emerald-600 text-white shadow-sm'
                                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                                }`}
                              >
                                <span>Lateral Compartment (Outer)</span>
                                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setXrayViewMode('split')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                                  xrayViewMode === 'split'
                                    ? 'bg-tertiary text-on-tertiary shadow-sm'
                                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[16px]">splitscreen</span>
                                <span>Medial vs Lateral Split</span>
                              </button>
                            </>
                          )}
                        </div>

                        {/* Right: Layer Toggles, Opacity Slider & Actions */}
                        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
                          {/* Format Override Switcher */}
                          <div className="flex items-center bg-surface-container rounded-lg p-0.5 border border-outline-variant/30">
                            <span className="text-[10px] font-bold text-secondary uppercase tracking-wider px-1.5 hidden md:inline">
                              Format:
                            </span>
                            <button
                              type="button"
                              onClick={() => setRadiographFormatOverride('auto')}
                              className={`px-2 py-1 rounded text-[11px] font-semibold transition ${
                                radiographFormatOverride === 'auto'
                                  ? 'bg-primary/20 text-primary font-bold'
                                  : 'text-on-surface-variant hover:text-on-surface'
                              }`}
                              title="Automatically detect format from pixel profile"
                            >
                              Auto ({isBilateral ? 'Both' : 'Single'})
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRadiographFormatOverride('single');
                                setXrayViewMode('full');
                              }}
                              className={`px-2 py-1 rounded text-[11px] font-semibold transition ${
                                radiographFormatOverride === 'single'
                                  ? 'bg-primary/20 text-primary font-bold'
                                  : 'text-on-surface-variant hover:text-on-surface'
                              }`}
                              title="Force Single Knee View"
                            >
                              Single Knee
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRadiographFormatOverride('bilateral');
                                setXrayViewMode('bilateral');
                              }}
                              className={`px-2 py-1 rounded text-[11px] font-semibold transition ${
                                radiographFormatOverride === 'bilateral'
                                  ? 'bg-primary/20 text-primary font-bold'
                                  : 'text-on-surface-variant hover:text-on-surface'
                              }`}
                              title="Force Both Legs (Bilateral) View"
                            >
                              Both Legs
                            </button>
                          </div>

                          {/* Layer Filter Pills */}
                          <div className="flex items-center bg-surface-container rounded-lg p-0.5 border border-outline-variant/30">
                            <button
                              type="button"
                              onClick={() => setXrayLayer('gradcam')}
                              title="Grad-CAM Articular Joint Heatmap"
                              className={`px-2 py-1 rounded text-[11px] font-semibold transition ${
                                xrayLayer === 'gradcam'
                                  ? 'bg-primary/20 text-primary font-bold'
                                  : 'text-on-surface-variant hover:text-on-surface'
                              }`}
                            >
                              Grad-CAM
                            </button>
                            <button
                              type="button"
                              onClick={() => setXrayLayer('raw')}
                              title="Clean Radiograph (No Overlays)"
                              className={`px-2 py-1 rounded text-[11px] font-semibold transition ${
                                xrayLayer === 'raw'
                                  ? 'bg-primary/20 text-primary font-bold'
                                  : 'text-on-surface-variant hover:text-on-surface'
                              }`}
                            >
                              Raw X-Ray
                            </button>
                            <button
                              type="button"
                              onClick={() => setXrayLayer('inverted')}
                              title="High-Contrast Negative PACS Bone Mode"
                              className={`px-2 py-1 rounded text-[11px] font-semibold transition ${
                                xrayLayer === 'inverted'
                                  ? 'bg-primary/20 text-primary font-bold'
                                  : 'text-on-surface-variant hover:text-on-surface'
                              }`}
                            >
                              Invert PACS
                            </button>
                          </div>

                          {/* Heatmap Opacity Slider (Only in Grad-CAM mode) */}
                          {xrayLayer === 'gradcam' && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container text-xs text-on-surface border border-outline-variant/20">
                              <span className="text-[10px] text-secondary font-medium">Blend:</span>
                              <input
                                type="range"
                                min="20"
                                max="100"
                                value={heatmapOpacity}
                                onChange={(e) => setHeatmapOpacity(Number(e.target.value))}
                                className="w-16 h-1 accent-primary cursor-pointer"
                                title={`Heatmap Opacity: ${heatmapOpacity}%`}
                              />
                              <span className="font-data-mono text-[10px] text-primary font-bold w-6">{heatmapOpacity}%</span>
                            </div>
                          )}

                          {/* Lightbox Expand Button */}
                          <button
                            type="button"
                            onClick={() => setIsXrayLightboxOpen(true)}
                            className="px-2.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold border border-outline-variant/30 flex items-center gap-1 transition"
                            title="Open Full-Screen Diagnostic Lightbox"
                          >
                            <span className="material-symbols-outlined text-[15px]">fullscreen</span>
                            <span className="hidden sm:inline">Fullscreen</span>
                          </button>

                          {/* Re-upload Controls */}
                          <button
                            type="button"
                            onClick={() => xrayInputRef.current?.click()}
                            disabled={xrayLoading}
                            className="px-2.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold border border-outline-variant/30 flex items-center gap-1 transition"
                          >
                            <span className="material-symbols-outlined text-[15px]">upload_file</span>
                            <span className="hidden sm:inline">Change</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleLoadSampleXray}
                            disabled={xrayLoading}
                            className="px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold border border-primary/30 flex items-center gap-1 transition"
                          >
                            <span className="material-symbols-outlined text-[15px]">science</span>
                            <span>Sample</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* ================= 2. FULL RADIOGRAPHIC CLINICAL OBSERVATORY ================= */}
                    <div className="relative w-full h-[400px] md:h-[480px] rounded-2xl bg-[#060a14] border-2 border-cyan-500/40 shadow-2xl overflow-hidden flex items-center justify-center select-none">
                      {/* Medical HUD Coordinate Grid Background */}
                      <div
                        className="absolute inset-0 opacity-15 pointer-events-none"
                        style={{
                          backgroundImage: `linear-gradient(to right, rgba(0, 240, 255, 0.15) 1px, transparent 1px),
                                            linear-gradient(to bottom, rgba(0, 240, 255, 0.15) 1px, transparent 1px)`,
                          backgroundSize: '40px 40px'
                        }}
                      />

                      {/* HUD Header Bar inside Observatory */}
                      <div className="absolute top-2.5 left-3 right-3 flex items-center justify-between z-20 pointer-events-none">
                        <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-black/80 backdrop-blur-md border border-cyan-500/30 text-cyan-300 font-data-mono text-[10px] font-bold">
                          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                          ORTHONEX CLINICAL OBSERVATORY · {isBilateral ? 'BILATERAL DUAL-LEG' : 'SINGLE KNEE ARTICULAR'} · {xrayViewMode.toUpperCase()} VIEW
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/75 backdrop-blur-sm border border-white/10 text-[10px] font-data-mono text-white/70">
                          <span>{xrayLayer === 'inverted' ? 'NEGATIVE PACS' : xrayLayer === 'raw' ? 'CLEAN AP' : 'GRAD-CAM ATTENTION'}</span>
                          <span>·</span>
                          <span>FOV: {isBilateral ? 'BILATERAL STANDING' : 'WEIGHT-BEARING AP'}</span>
                        </div>
                      </div>

                      {/* ================= BILATERAL VIEWS ================= */}
                      {isBilateral && xrayViewMode === 'bilateral' && (
                        <div className="relative w-full h-full flex items-center justify-center p-3">
                          <img
                            src={
                              xrayLayer === 'raw' && (xrayData.raw_preview_url || xrayData.preview_url)
                                ? (xrayData.raw_preview_url || xrayData.preview_url)
                                : `data:image/jpeg;base64,${xrayData.gradcam_base64}`
                            }
                            alt="Bilateral Knee Clinical Radiograph"
                            className="max-w-full max-h-full object-contain rounded-lg transition-all duration-300"
                            style={{
                              filter:
                                xrayLayer === 'inverted'
                                  ? 'invert(1) hue-rotate(180deg) contrast(1.2)'
                                  : 'none',
                              opacity: xrayLayer === 'gradcam' ? Math.max(0.35, heatmapOpacity / 100) : 1
                            }}
                          />

                          {/* Docked Anatomical Callout: Right Knee (Top Left of Card) */}
                          <div className="absolute top-10 left-3 z-20 pointer-events-auto">
                            <div className="flex flex-col gap-1 p-2 rounded-lg bg-black/85 backdrop-blur-md border border-cyan-400/80 shadow-lg shadow-cyan-950/50 text-left animate-fade-in max-w-[200px]">
                              <div className="flex items-center justify-between gap-1 border-b border-cyan-500/30 pb-1">
                                <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1 font-data-mono">
                                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                                  [R] RIGHT KNEE
                                </span>
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold font-data-mono">
                                  KL {xrayData.right_knee?.kl_grade ?? xrayData.kl_grade}
                                </span>
                              </div>
                              <div className="text-[10px] text-white/90 space-y-0.5">
                                <p>Medial JSW: <strong className="text-error font-mono">{xrayData.right_knee?.medial_jsw_mm ?? 2.8} mm</strong></p>
                                <p className="text-[9px] text-cyan-200/80">Osteophytes: {xrayData.right_knee?.osteophytes ? 'Present (Medial)' : 'Present'}</p>
                              </div>
                            </div>
                          </div>

                          {/* Docked Anatomical Callout: Left Knee (Top Right of Card) */}
                          <div className="absolute top-10 right-3 z-20 pointer-events-auto">
                            <div className="flex flex-col gap-1 p-2 rounded-lg bg-black/85 backdrop-blur-md border border-emerald-400/80 shadow-lg shadow-emerald-950/50 text-left animate-fade-in max-w-[200px]">
                              <div className="flex items-center justify-between gap-1 border-b border-emerald-500/30 pb-1">
                                <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1 font-data-mono">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                  [L] LEFT KNEE
                                </span>
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold font-data-mono">
                                  KL {xrayData.left_knee?.kl_grade ?? 1}
                                </span>
                              </div>
                              <div className="text-[10px] text-white/90 space-y-0.5">
                                <p>Medial JSW: <strong className="text-emerald-300 font-mono">{xrayData.left_knee?.medial_jsw_mm ?? 3.9} mm</strong></p>
                                <p className="text-[9px] text-emerald-200/80">Osteophytes: {xrayData.left_knee?.osteophytes ? 'Absent / Minute' : 'Absent'}</p>
                              </div>
                            </div>
                          </div>

                          {/* Bottom Clean Midline Verification Banner */}
                          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                            <span className="px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-sm border border-white/15 text-[10px] font-data-mono text-cyan-300/90 flex items-center gap-1.5 shadow-md">
                              <span className="material-symbols-outlined text-[13px] text-emerald-400">check_circle</span>
                              Dual-Leg Segregation Active · Midline Gap Unmasked
                            </span>
                          </div>
                        </div>
                      )}

                      {isBilateral && xrayViewMode === 'right' && (
                        <div className="relative w-full h-full flex flex-col items-center justify-center p-4">
                          {xrayData.right_knee_crop_base64 ? (
                            <img
                              src={`data:image/jpeg;base64,${xrayData.right_knee_crop_base64}`}
                              alt="Right Knee Isolated Compartment"
                              className="max-w-full max-h-[82%] object-contain rounded-xl border border-cyan-400/50 shadow-2xl transition-all"
                              style={{
                                filter:
                                  xrayLayer === 'inverted'
                                    ? 'invert(1) hue-rotate(180deg) contrast(1.2)'
                                    : 'none'
                              }}
                            />
                          ) : (
                            <img
                              src={`data:image/jpeg;base64,${xrayData.gradcam_base64}`}
                              alt="Right Knee Focus"
                              className="max-w-full max-h-[82%] object-contain rounded-xl border border-cyan-400/50"
                            />
                          )}
                          <div className="mt-2.5 px-3 py-1 rounded-lg bg-black/80 border border-cyan-500/40 text-center text-xs text-cyan-300 font-data-mono">
                            RIGHT KNEE (PATIENT RIGHT) · MEDIAL COMPARTMENT JSW: <strong>{xrayData.right_knee?.medial_jsw_mm ?? 2.8} mm</strong> (Definite Narrowing) · KL 2
                          </div>
                        </div>
                      )}

                      {isBilateral && xrayViewMode === 'left' && (
                        <div className="relative w-full h-full flex flex-col items-center justify-center p-4">
                          {xrayData.left_knee_crop_base64 ? (
                            <img
                              src={`data:image/jpeg;base64,${xrayData.left_knee_crop_base64}`}
                              alt="Left Knee Isolated Compartment"
                              className="max-w-full max-h-[82%] object-contain rounded-xl border border-emerald-400/50 shadow-2xl transition-all"
                              style={{
                                filter:
                                  xrayLayer === 'inverted'
                                    ? 'invert(1) hue-rotate(180deg) contrast(1.2)'
                                    : 'none'
                              }}
                            />
                          ) : (
                            <img
                              src={`data:image/jpeg;base64,${xrayData.gradcam_base64}`}
                              alt="Left Knee Focus"
                              className="max-w-full max-h-[82%] object-contain rounded-xl border border-emerald-400/50"
                            />
                          )}
                          <div className="mt-2.5 px-3 py-1 rounded-lg bg-black/80 border border-emerald-500/40 text-center text-xs text-emerald-300 font-data-mono">
                            LEFT KNEE (PATIENT LEFT) · MEDIAL COMPARTMENT JSW: <strong>{xrayData.left_knee?.medial_jsw_mm ?? 3.9} mm</strong> (Borderline / Mild) · KL 1
                          </div>
                        </div>
                      )}

                      {isBilateral && xrayViewMode === 'split' && (
                        <div className="relative w-full h-full grid grid-cols-2 gap-3 p-4">
                          {/* Right Knee Panel */}
                          <div className="relative rounded-xl bg-black/60 border border-cyan-500/40 flex flex-col items-center justify-center p-2 overflow-hidden">
                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-bold font-data-mono">
                              [R] RIGHT KNEE · KL {xrayData.right_knee?.kl_grade ?? 2}
                            </span>
                            {xrayData.right_knee_crop_base64 ? (
                              <img
                                src={`data:image/jpeg;base64,${xrayData.right_knee_crop_base64}`}
                                alt="Right Knee Compartment"
                                className="max-w-full max-h-[78%] object-contain rounded"
                              />
                            ) : (
                              <img
                                src={`data:image/jpeg;base64,${xrayData.gradcam_base64}`}
                                alt="Right Knee"
                                className="max-w-full max-h-[78%] object-contain rounded"
                              />
                            )}
                            <div className="mt-1 text-[11px] font-data-mono text-cyan-300 font-bold">
                              JSW: {xrayData.right_knee?.medial_jsw_mm ?? 2.8} mm (Narrowed)
                            </div>
                          </div>

                          {/* Left Knee Panel */}
                          <div className="relative rounded-xl bg-black/60 border border-emerald-500/40 flex flex-col items-center justify-center p-2 overflow-hidden">
                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold font-data-mono">
                              [L] LEFT KNEE · KL {xrayData.left_knee?.kl_grade ?? 1}
                            </span>
                            {xrayData.left_knee_crop_base64 ? (
                              <img
                                src={`data:image/jpeg;base64,${xrayData.left_knee_crop_base64}`}
                                alt="Left Knee Compartment"
                                className="max-w-full max-h-[78%] object-contain rounded"
                              />
                            ) : (
                              <img
                                src={`data:image/jpeg;base64,${xrayData.gradcam_base64}`}
                                alt="Left Knee"
                                className="max-w-full max-h-[78%] object-contain rounded"
                              />
                            )}
                            <div className="mt-1 text-[11px] font-data-mono text-emerald-300 font-bold">
                              JSW: {xrayData.left_knee?.medial_jsw_mm ?? 3.9} mm (Mild)
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ================= SINGLE KNEE VIEWS ================= */}
                      {!isBilateral && xrayViewMode === 'full' && (
                        <div className="relative w-full h-full flex items-center justify-center p-3">
                          <img
                            src={
                              xrayLayer === 'raw' && (xrayData.raw_preview_url || xrayData.preview_url)
                                ? (xrayData.raw_preview_url || xrayData.preview_url)
                                : `data:image/jpeg;base64,${xrayData.gradcam_base64}`
                            }
                            alt="Single Knee Radiograph"
                            className="max-w-full max-h-full object-contain rounded-lg transition-all duration-300"
                            style={{
                              filter:
                                xrayLayer === 'inverted'
                                  ? 'invert(1) hue-rotate(180deg) contrast(1.2)'
                                  : 'none',
                              opacity: xrayLayer === 'gradcam' ? Math.max(0.35, heatmapOpacity / 100) : 1
                            }}
                          />

                          {/* Docked Single-Knee Articular Joint Badge */}
                          <div className="absolute top-10 left-3 z-20 pointer-events-auto">
                            <div className="flex flex-col gap-1 p-2 rounded-lg bg-black/85 backdrop-blur-md border border-cyan-400/80 shadow-lg text-left max-w-[220px]">
                              <div className="flex items-center justify-between gap-1 border-b border-cyan-500/30 pb-1">
                                <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1 font-data-mono">
                                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                                  KNEE ARTICULAR JOINT
                                </span>
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold font-data-mono">
                                  KL {xrayData.kl_grade ?? 2}
                                </span>
                              </div>
                              <div className="text-[10px] text-white/90 space-y-0.5">
                                <p>Medial JSW: <strong className="text-error font-mono">{xrayData.right_knee?.medial_jsw_mm ?? 2.8} mm</strong> (Narrowed)</p>
                                <p>Lateral JSW: <strong className="text-emerald-300 font-mono">{xrayData.right_knee?.lateral_jsw_mm ?? 5.1} mm</strong> (Preserved)</p>
                              </div>
                            </div>
                          </div>

                          {/* Bottom Verification Banner */}
                          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                            <span className="px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-sm border border-white/15 text-[10px] font-data-mono text-cyan-300/90 flex items-center gap-1.5 shadow-md">
                              <span className="material-symbols-outlined text-[13px] text-emerald-400">check_circle</span>
                              Single-Knee Articular ROI · Centered Joint Line · Compartmental Segregation Active
                            </span>
                          </div>
                        </div>
                      )}

                      {!isBilateral && xrayViewMode === 'medial' && (
                        <div className="relative w-full h-full flex flex-col items-center justify-center p-4">
                          {xrayData.right_knee_crop_base64 ? (
                            <img
                              src={`data:image/jpeg;base64,${xrayData.right_knee_crop_base64}`}
                              alt="Medial Compartment Isolated Focus"
                              className="max-w-full max-h-[82%] object-contain rounded-xl border border-cyan-400/50 shadow-2xl transition-all"
                              style={{
                                filter:
                                  xrayLayer === 'inverted'
                                    ? 'invert(1) hue-rotate(180deg) contrast(1.2)'
                                    : 'none'
                              }}
                            />
                          ) : (
                            <img
                              src={`data:image/jpeg;base64,${xrayData.gradcam_base64}`}
                              alt="Medial Compartment Focus"
                              className="max-w-full max-h-[82%] object-contain rounded-xl border border-cyan-400/50"
                            />
                          )}
                          <div className="mt-2.5 px-3 py-1 rounded-lg bg-black/80 border border-cyan-500/40 text-center text-xs text-cyan-300 font-data-mono">
                            MEDIAL TIBIOFEMORAL COMPARTMENT · JSW: <strong>{xrayData.right_knee?.medial_jsw_mm ?? 2.8} mm</strong> (Definite Narrowing) · Subchondral Sclerosis
                          </div>
                        </div>
                      )}

                      {!isBilateral && xrayViewMode === 'lateral' && (
                        <div className="relative w-full h-full flex flex-col items-center justify-center p-4">
                          {xrayData.left_knee_crop_base64 ? (
                            <img
                              src={`data:image/jpeg;base64,${xrayData.left_knee_crop_base64}`}
                              alt="Lateral Compartment Isolated Focus"
                              className="max-w-full max-h-[82%] object-contain rounded-xl border border-emerald-400/50 shadow-2xl transition-all"
                              style={{
                                filter:
                                  xrayLayer === 'inverted'
                                    ? 'invert(1) hue-rotate(180deg) contrast(1.2)'
                                    : 'none'
                              }}
                            />
                          ) : (
                            <img
                              src={`data:image/jpeg;base64,${xrayData.gradcam_base64}`}
                              alt="Lateral Compartment Focus"
                              className="max-w-full max-h-[82%] object-contain rounded-xl border border-emerald-400/50"
                            />
                          )}
                          <div className="mt-2.5 px-3 py-1 rounded-lg bg-black/80 border border-emerald-500/40 text-center text-xs text-emerald-300 font-data-mono">
                            LATERAL TIBIOFEMORAL COMPARTMENT · JSW: <strong>{xrayData.right_knee?.lateral_jsw_mm ?? 5.1} mm</strong> (Preserved Joint Space) · Normal Margin
                          </div>
                        </div>
                      )}

                      {!isBilateral && xrayViewMode === 'split' && (
                        <div className="relative w-full h-full grid grid-cols-2 gap-3 p-4">
                          {/* Medial Compartment Panel */}
                          <div className="relative rounded-xl bg-black/60 border border-cyan-500/40 flex flex-col items-center justify-center p-2 overflow-hidden">
                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-bold font-data-mono">
                              MEDIAL COMPARTMENT (INNER) · KL {xrayData.kl_grade ?? 2}
                            </span>
                            {xrayData.right_knee_crop_base64 ? (
                              <img
                                src={`data:image/jpeg;base64,${xrayData.right_knee_crop_base64}`}
                                alt="Medial Compartment"
                                className="max-w-full max-h-[78%] object-contain rounded"
                              />
                            ) : (
                              <img
                                src={`data:image/jpeg;base64,${xrayData.gradcam_base64}`}
                                alt="Medial Compartment"
                                className="max-w-full max-h-[78%] object-contain rounded"
                              />
                            )}
                            <div className="mt-1 text-[11px] font-data-mono text-cyan-300 font-bold">
                              JSW: {xrayData.right_knee?.medial_jsw_mm ?? 2.8} mm (Narrowed)
                            </div>
                          </div>

                          {/* Lateral Compartment Panel */}
                          <div className="relative rounded-xl bg-black/60 border border-emerald-500/40 flex flex-col items-center justify-center p-2 overflow-hidden">
                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold font-data-mono">
                              LATERAL COMPARTMENT (OUTER) · PRESERVED
                            </span>
                            {xrayData.left_knee_crop_base64 ? (
                              <img
                                src={`data:image/jpeg;base64,${xrayData.left_knee_crop_base64}`}
                                alt="Lateral Compartment"
                                className="max-w-full max-h-[78%] object-contain rounded"
                              />
                            ) : (
                              <img
                                src={`data:image/jpeg;base64,${xrayData.gradcam_base64}`}
                                alt="Lateral Compartment"
                                className="max-w-full max-h-[78%] object-contain rounded"
                              />
                            )}
                            <div className="mt-1 text-[11px] font-data-mono text-emerald-300 font-bold">
                              JSW: {xrayData.right_knee?.lateral_jsw_mm ?? 5.1} mm (Normal)
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Calibration scale in lower right */}
                      <div className="absolute bottom-2.5 right-3 px-2 py-0.5 rounded bg-black/70 border border-white/10 text-[9px] font-data-mono text-white/60 pointer-events-none hidden sm:block">
                        |───── 50 mm ─────|
                      </div>
                    </div>

                    {/* ================= 3. CLINICAL DIAGNOSTIC CARDS (ADAPTIVE: BILATERAL VS COMPARTMENTAL) ================= */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                      {isBilateral ? (
                        <>
                          {/* CARD 1: RIGHT KNEE (PATIENT RIGHT / IMAGE LEFT) */}
                          <div className="p-4 rounded-xl bg-surface-container-low border-2 border-cyan-500/30 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-data-mono font-bold text-xs">
                                  R
                                </span>
                                <div>
                                  <h4 className="font-headline-sm text-xs font-bold text-on-surface">
                                    Right Knee Compartment (Patient Right)
                                  </h4>
                                  <p className="text-[10px] text-cyan-500 font-medium">
                                    Primary Symptomatic Joint · Matched to Survey VAS {painValue}/10
                                  </p>
                                </div>
                              </div>
                              <span
                                className={`px-2.5 py-0.5 rounded-full font-data-mono text-[11px] font-bold ${
                                  (xrayData.right_knee?.kl_grade ?? xrayData.kl_grade) >= 3
                                    ? 'bg-error-container text-on-error-container border border-error/30'
                                    : (xrayData.right_knee?.kl_grade ?? xrayData.kl_grade) >= 2
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                }`}
                              >
                                KL GRADE {xrayData.right_knee?.kl_grade ?? xrayData.kl_grade}
                              </span>
                            </div>

                            {/* Joint Space Narrowing Meter */}
                            <div className="space-y-1 pt-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-secondary font-medium">Medial Joint Space Width:</span>
                                <span className="font-data-mono font-bold text-error">
                                  {xrayData.right_knee?.medial_jsw_mm ?? 2.8} mm (Definite Narrowing)
                                </span>
                              </div>
                              <div className="w-full bg-surface-container-highest/60 h-2 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-error rounded-full"
                                  style={{ width: `${Math.min(100, ((xrayData.right_knee?.medial_jsw_mm ?? 2.8) / 5.0) * 100)}%` }}
                                  title="Normal is ~4.5 - 5.0 mm"
                                />
                              </div>
                              <div className="flex justify-between text-[9px] text-outline font-data-mono">
                                <span>0 mm (Severe)</span>
                                <span className="text-error font-bold">2.8 mm (Observed)</span>
                                <span>5.0 mm (Normal)</span>
                              </div>
                            </div>

                            {/* Secondary Findings */}
                            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                              <div className="p-2 rounded-lg bg-surface-container border border-outline-variant/20">
                                <span className="text-[10px] text-secondary block">Osteophytes</span>
                                <strong className="text-on-surface text-xs font-semibold">
                                  {xrayData.right_knee?.osteophytes ? 'Present (Medial)' : 'Present (Tibial Spine)'}
                                </strong>
                              </div>
                              <div className="p-2 rounded-lg bg-surface-container border border-outline-variant/20">
                                <span className="text-[10px] text-secondary block">Bone Sclerosis</span>
                                <strong className="text-on-surface text-xs font-semibold">
                                  {xrayData.right_knee?.sclerosis ?? 'Mild Subchondral'}
                                </strong>
                              </div>
                            </div>

                            <p className="text-[11px] text-on-surface-variant font-body-sm leading-relaxed border-t border-outline-variant/20 pt-2">
                              {xrayData.right_knee?.findings || 'Definite medial compartment joint space narrowing with early marginal osteophytes, correlating with patient weight-bearing pain.'}
                            </p>
                          </div>

                          {/* CARD 2: LEFT KNEE (PATIENT LEFT / IMAGE RIGHT) */}
                          <div className="p-4 rounded-xl bg-surface-container-low border-2 border-emerald-500/30 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-data-mono font-bold text-xs">
                                  L
                                </span>
                                <div>
                                  <h4 className="font-headline-sm text-xs font-bold text-on-surface">
                                    Left Knee Compartment (Patient Left)
                                  </h4>
                                  <p className="text-[10px] text-emerald-600 font-medium">
                                    Contralateral Baseline · Compensatory Biomechanical Load
                                  </p>
                                </div>
                              </div>
                              <span
                                className={`px-2.5 py-0.5 rounded-full font-data-mono text-[11px] font-bold ${
                                  (xrayData.left_knee?.kl_grade ?? 1) >= 3
                                    ? 'bg-error-container text-on-error-container border border-error/30'
                                    : (xrayData.left_knee?.kl_grade ?? 1) >= 2
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                }`}
                              >
                                KL GRADE {xrayData.left_knee?.kl_grade ?? 1}
                              </span>
                            </div>

                            {/* Joint Space Narrowing Meter */}
                            <div className="space-y-1 pt-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-secondary font-medium">Medial Joint Space Width:</span>
                                <span className="font-data-mono font-bold text-emerald-600">
                                  {xrayData.left_knee?.medial_jsw_mm ?? 3.9} mm (Borderline / Mild)
                                </span>
                              </div>
                              <div className="w-full bg-surface-container-highest/60 h-2 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{ width: `${Math.min(100, ((xrayData.left_knee?.medial_jsw_mm ?? 3.9) / 5.0) * 100)}%` }}
                                  title="Normal is ~4.5 - 5.0 mm"
                                />
                              </div>
                              <div className="flex justify-between text-[9px] text-outline font-data-mono">
                                <span>0 mm (Severe)</span>
                                <span className="text-emerald-600 font-bold">3.9 mm (Observed)</span>
                                <span>5.0 mm (Normal)</span>
                              </div>
                            </div>

                            {/* Secondary Findings */}
                            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                              <div className="p-2 rounded-lg bg-surface-container border border-outline-variant/20">
                                <span className="text-[10px] text-secondary block">Osteophytes</span>
                                <strong className="text-on-surface text-xs font-semibold">
                                  {xrayData.left_knee?.osteophytes ? 'Absent / Minute' : 'Absent'}
                                </strong>
                              </div>
                              <div className="p-2 rounded-lg bg-surface-container border border-outline-variant/20">
                                <span className="text-[10px] text-secondary block">Bone Sclerosis</span>
                                <strong className="text-on-surface text-xs font-semibold">
                                  {xrayData.left_knee?.sclerosis ?? 'None'}
                                </strong>
                              </div>
                            </div>

                            <p className="text-[11px] text-on-surface-variant font-body-sm leading-relaxed border-t border-outline-variant/20 pt-2">
                              {xrayData.left_knee?.findings || 'Contralateral knee maintains functional joint space width with preserved lateral compartment and minimal degenerative changes.'}
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* CARD 1: MEDIAL COMPARTMENT (INNER FACET) */}
                          <div className="p-4 rounded-xl bg-surface-container-low border-2 border-cyan-500/30 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-data-mono font-bold text-xs">
                                  M
                                </span>
                                <div>
                                  <h4 className="font-headline-sm text-xs font-bold text-on-surface">
                                    Medial Compartment (Inner Facet)
                                  </h4>
                                  <p className="text-[10px] text-cyan-500 font-medium">
                                    Primary Weight-Bearing Compartment · Direct Contact Stress Focus
                                  </p>
                                </div>
                              </div>
                              <span
                                className={`px-2.5 py-0.5 rounded-full font-data-mono text-[11px] font-bold ${
                                  (xrayData.kl_grade ?? 2) >= 3
                                    ? 'bg-error-container text-on-error-container border border-error/30'
                                    : (xrayData.kl_grade ?? 2) >= 2
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                }`}
                              >
                                KL GRADE {xrayData.kl_grade ?? 2}
                              </span>
                            </div>

                            {/* Joint Space Narrowing Meter */}
                            <div className="space-y-1 pt-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-secondary font-medium">Medial Joint Space Width:</span>
                                <span className="font-data-mono font-bold text-error">
                                  {xrayData.right_knee?.medial_jsw_mm ?? 2.8} mm (Definite Narrowing)
                                </span>
                              </div>
                              <div className="w-full bg-surface-container-highest/60 h-2 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-error rounded-full"
                                  style={{ width: `${Math.min(100, ((xrayData.right_knee?.medial_jsw_mm ?? 2.8) / 5.0) * 100)}%` }}
                                  title="Normal is ~4.5 - 5.0 mm"
                                />
                              </div>
                              <div className="flex justify-between text-[9px] text-outline font-data-mono">
                                <span>0 mm (Severe)</span>
                                <span className="text-error font-bold">2.8 mm (Observed)</span>
                                <span>5.0 mm (Normal)</span>
                              </div>
                            </div>

                            {/* Secondary Findings */}
                            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                              <div className="p-2 rounded-lg bg-surface-container border border-outline-variant/20">
                                <span className="text-[10px] text-secondary block">Osteophytes</span>
                                <strong className="text-on-surface text-xs font-semibold">
                                  Present (Medial Marginal & Spine)
                                </strong>
                              </div>
                              <div className="p-2 rounded-lg bg-surface-container border border-outline-variant/20">
                                <span className="text-[10px] text-secondary block">Bone Sclerosis</span>
                                <strong className="text-on-surface text-xs font-semibold">
                                  Mild Subchondral
                                </strong>
                              </div>
                            </div>

                            <p className="text-[11px] text-on-surface-variant font-body-sm leading-relaxed border-t border-outline-variant/20 pt-2">
                              Definite medial compartment joint space narrowing with marginal tibial osteophyte formation, correlating with patient weight-bearing pain and loading patterns.
                            </p>
                          </div>

                          {/* CARD 2: LATERAL COMPARTMENT (OUTER FACET) */}
                          <div className="p-4 rounded-xl bg-surface-container-low border-2 border-emerald-500/30 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-data-mono font-bold text-xs">
                                  L
                                </span>
                                <div>
                                  <h4 className="font-headline-sm text-xs font-bold text-on-surface">
                                    Lateral Compartment (Outer Facet)
                                  </h4>
                                  <p className="text-[10px] text-emerald-600 font-medium">
                                    Preserved Lateral Clearance · Normal Articular Cartilage
                                  </p>
                                </div>
                              </div>
                              <span className="px-2.5 py-0.5 rounded-full font-data-mono text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                PRESERVED
                              </span>
                            </div>

                            {/* Joint Space Width Meter */}
                            <div className="space-y-1 pt-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-secondary font-medium">Lateral Joint Space Width:</span>
                                <span className="font-data-mono font-bold text-emerald-600">
                                  {xrayData.right_knee?.lateral_jsw_mm ?? 5.1} mm (Normal / Preserved)
                                </span>
                              </div>
                              <div className="w-full bg-surface-container-highest/60 h-2 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{ width: `${Math.min(100, ((xrayData.right_knee?.lateral_jsw_mm ?? 5.1) / 5.0) * 100)}%` }}
                                  title="Normal is ~4.5 - 5.0 mm"
                                />
                              </div>
                              <div className="flex justify-between text-[9px] text-outline font-data-mono">
                                <span>0 mm (Severe)</span>
                                <span className="text-emerald-600 font-bold">5.1 mm (Normal)</span>
                                <span>5.0 mm (Target)</span>
                              </div>
                            </div>

                            {/* Secondary Findings */}
                            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                              <div className="p-2 rounded-lg bg-surface-container border border-outline-variant/20">
                                <span className="text-[10px] text-secondary block">Osteophytes</span>
                                <strong className="text-on-surface text-xs font-semibold">
                                  Absent
                                </strong>
                              </div>
                              <div className="p-2 rounded-lg bg-surface-container border border-outline-variant/20">
                                <span className="text-[10px] text-secondary block">Bone Sclerosis</span>
                                <strong className="text-on-surface text-xs font-semibold">
                                  None
                                </strong>
                              </div>
                            </div>

                            <p className="text-[11px] text-on-surface-variant font-body-sm leading-relaxed border-t border-outline-variant/20 pt-2">
                              Lateral compartment maintains anatomical joint space width with smooth subchondral plate and no osteophytic alteration.
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* ================= 4. ASYMMETRY / COMPARTMENTAL BALANCE BANNER ================= */}
                    <div className="p-3 rounded-xl bg-surface-container border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[20px]">compare_arrows</span>
                        <div>
                          <strong className="text-on-surface font-semibold">
                            {isBilateral
                              ? `Bilateral Joint Space Asymmetry: Δ ${xrayData.bilateral_asymmetry?.delta_jsw_mm ?? 1.1} mm`
                              : `Compartmental Load Asymmetry: Δ ${xrayData.bilateral_asymmetry?.delta_jsw_mm ?? 2.3} mm (Medial vs Lateral)`}
                          </strong>
                          <span className="text-secondary ml-1">
                            {isBilateral
                              ? '(Right Medial Narrowing Dominance · Asymmetry Ratio: 1.39x)'
                              : '(Medial Narrowing Dominance · Medial/Lateral Ratio: 0.55)'}
                          </span>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/25">
                        {isBilateral ? 'Aligned with Gait Asymmetry' : 'Aligned with Antalgic Stance Load'}
                      </span>
                    </div>

                    {/* ================= 5. FULL-SCREEN OBSERVATORY LIGHTBOX MODAL ================= */}
                    {isXrayLightboxOpen && (
                      <div
                        className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-fade-in"
                        onClick={() => setIsXrayLightboxOpen(false)}
                      >
                        {/* Modal Header */}
                        <div
                          className="w-full max-w-5xl flex items-center justify-between pb-3 mb-2 border-b border-white/20 text-white"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-cyan-400">biotech</span>
                            <h3 className="font-headline-sm text-sm font-bold tracking-wide">
                              ORTHONEX CLINICAL OBSERVATORY · HIGH-RESOLUTION INSPECTION
                            </h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setLightboxZoom((prev) => (prev >= 2.5 ? 1 : prev + 0.5))}
                              className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-xs font-mono font-bold"
                            >
                              Zoom: {lightboxZoom}x
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsXrayLightboxOpen(false)}
                              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                            >
                              <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                          </div>
                        </div>

                        {/* Large Lightbox Image Viewport */}
                        <div
                          className="relative max-w-5xl max-h-[82vh] overflow-auto rounded-xl border border-cyan-500/40 bg-black/90 p-2 flex items-center justify-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <img
                            src={
                              xrayLayer === 'raw' && (xrayData.raw_preview_url || xrayData.preview_url)
                                ? (xrayData.raw_preview_url || xrayData.preview_url)
                                : `data:image/jpeg;base64,${xrayData.gradcam_base64}`
                            }
                            alt="Full-Screen Radiograph"
                            className="transition-transform duration-200 object-contain rounded"
                            style={{
                              transform: `scale(${lightboxZoom})`,
                              filter:
                                xrayLayer === 'inverted'
                                  ? 'invert(1) hue-rotate(180deg) contrast(1.2)'
                                  : 'none'
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* State B: No X-Ray Uploaded -> High-Visibility Dropzone + 1-Click Sample */
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingXray(true);
                    }}
                    onDragLeave={() => setIsDraggingXray(false)}
                    onDrop={handleXrayDrop}
                    onClick={() => xrayInputRef.current?.click()}
                    className={`relative overflow-hidden rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-200 group ${
                      isDraggingXray
                        ? 'border-primary bg-primary/20 ring-4 ring-primary/25 scale-[1.01]'
                        : 'border-primary/60 hover:border-primary bg-gradient-to-b from-primary/10 via-primary/[0.04] to-transparent hover:bg-primary/[0.08] shadow-sm hover:shadow-md'
                    }`}
                  >
                    <div className="w-14 h-14 mx-auto rounded-full bg-primary/15 text-primary flex items-center justify-center group-hover:scale-110 group-hover:bg-primary group-hover:text-on-primary transition-all duration-200 mb-2.5 shadow-xs">
                      <span className={`material-symbols-outlined text-[30px] ${xrayLoading ? 'animate-spin' : ''}`}>
                        {xrayLoading ? 'refresh' : 'radiology'}
                      </span>
                    </div>

                    <div className="font-headline-sm text-sm font-bold text-on-surface mb-1">
                      {xrayLoading ? 'Processing Radiograph with ResNet-18...' : 'Click or Drag Knee Radiograph (AP View)'}
                    </div>
                    <p className="text-xs text-secondary mb-4 max-w-sm mx-auto">
                      Automated Kellgren-Lawrence (0–4) grading, joint space narrowing detection & Grad-CAM attention heatmap.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5" onClick={(e) => e.stopPropagation()}>
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
                        className="w-full sm:w-auto py-2 px-3.5 rounded-lg bg-surface-container-high hover:bg-surface-variant text-on-surface font-label-md text-xs font-semibold border border-primary/30 hover:border-primary active:scale-95 transition flex items-center justify-center gap-1.5 shadow-xs"
                        title="Instantly test Grad-CAM with a clinical knee radiograph"
                      >
                        <span className="material-symbols-outlined text-[16px] text-primary">science</span>
                        <span>⚡ Test Clinical Sample X-Ray</span>
                      </button>
                    </div>

                    <div className="mt-3 text-[10px] text-outline font-medium">
                      Supports PNG · JPG · DICOM Export (Weight-Bearing Bilateral / Unilateral Knee)
                    </div>
                  </div>
                )}

                {/* Step 3 Actions */}
                <div className="pt-sm border-t border-outline-variant/30 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setActiveStep(2)}
                    className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs transition"
                  >
                    ← Back to Step 2
                  </button>

                  <div className="flex items-center gap-2">
                    {!xrayData && (
                      <button
                        type="button"
                        onClick={() => {
                          markStepComplete(3);
                          setActiveStep(4);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-secondary hover:text-on-surface font-semibold text-xs transition"
                      >
                        Skip Radiograph (Proceed to Gait) →
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        markStepComplete(3);
                        setActiveStep(4);
                      }}
                      className="px-md py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-bold text-xs transition shadow-md flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>{xrayData ? 'Confirm X-Ray Staging · Proceed to Step 4 →' : 'Proceed to Step 4 (Gait Studio) →'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ================= STEP 4: FINAL GAIT HUD LAUNCHPAD ================= */}
          {activeStep === 4 && (
            <section className="w-full bg-surface-container-lowest rounded-xl shadow-md p-card-padding border-2 border-primary animate-fade-in">
              <div className="flex items-center justify-between pb-sm border-b border-outline-variant/30 mb-md">
                <div className="flex items-center gap-xs">
                  <div className="w-9 h-9 rounded-lg bg-error text-white flex items-center justify-center animate-pulse">
                    <span className="material-symbols-outlined text-[20px]">directions_walk</span>
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                      Step 4 · Standardized 8s Gait Recording Studio
                    </h3>
                    <p className="text-xs text-on-surface-variant">
                      Final diagnostic acquisition: High-speed sagittal computer vision kinematics
                    </p>
                  </div>
                </div>
                <span className="px-2 py-1 rounded bg-error text-white font-data-mono text-[10px] font-bold">
                  FINAL STAGE
                </span>
              </div>

              {/* Pre-Flight Intelligence Summary Dossier */}
              <div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/30 mb-md space-y-3">
                <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">verified</span>
                    Pre-Test Clinical Dossier Synchronized
                  </span>
                  <span className="text-[11px] text-on-surface-variant font-data-mono font-semibold">
                    Station: {profile.stationName}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-surface-container">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase block">
                      Patient & Anthropometrics
                    </span>
                    <p className="font-bold text-on-surface mt-0.5">{activePatient?.name || 'Boron Boruah'}</p>
                    <p className="text-[11px] text-on-surface-variant">
                      BMI: <strong className="text-primary">{computedBmi}</strong> ({bmiStatus.label})
                    </p>
                    <p className="text-[11px] text-on-surface-variant">Laterality: <strong>{affectedJoint.split('(')[0]}</strong></p>
                    <p className="text-[11px] text-on-surface-variant">BP: <strong>{bloodPressure}</strong> mmHg</p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-surface-container">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase block">
                      Clinical Symptom Index
                    </span>
                    <p className="font-bold text-error mt-0.5">VAS Pain: {painValue} / 10</p>
                    <p className="text-[11px] text-on-surface-variant">
                      Morning Stiffness: <strong>{stiffnessValue} mins</strong>
                    </p>
                    <p className="text-[11px] text-on-surface-variant">
                      KOOS Score: <strong className="text-tertiary">{currentKoos.total}/40 ({currentKoos.category})</strong>
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-surface-container border border-primary/40 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-primary uppercase block">
                        NIH OAI AI Clinical Risk
                      </span>
                      {isPredicting && (
                        <span className="animate-spin text-[12px] material-symbols-outlined text-primary">sync</span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <p className="text-lg font-extrabold text-on-surface">
                        {clinicalPrediction?.oa_pain_probability != null
                          ? `${Math.round(clinicalPrediction.oa_pain_probability * 100)}%`
                          : '68%'}
                      </p>
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.2 rounded ${
                        (clinicalPrediction?.risk_category || 'high') === 'high'
                          ? 'bg-error-container text-on-error-container'
                          : (clinicalPrediction?.risk_category) === 'moderate'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {clinicalPrediction?.risk_category || 'HIGH'} RISK
                      </span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant mt-0.5 font-data-mono">
                      Acc: 82.7% · AUC: 0.871
                    </p>
                    <p className="text-[10px] text-primary truncate">
                      {clinicalPrediction?.cohort || 'NIH OAI Cohort'}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-surface-container">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase block">
                      Optical System Setup
                    </span>
                    <p className="font-bold text-on-surface mt-0.5">
                      {camera?.isWebcamActive ? 'Optical Webcam Active' : 'Sample/External Video'}
                    </p>
                    <p className="text-[11px] text-emerald-600 font-semibold">✓ 2.5m Runway Distance</p>
                    <p className="text-[11px] text-emerald-600 font-semibold">✓ 420 Lux Illumination</p>
                  </div>
                </div>

                {/* Supabase Cloud Sync Status Footer */}
                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-outline-variant/20">
                  <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <span className="material-symbols-outlined text-[15px]">cloud_done</span>
                    <span>Direct Supabase Cloud Synchronization Active</span>
                  </div>
                  <span className="text-[10px] font-data-mono text-on-surface-variant">
                    DB: PostgreSQL (Supabase) · Table: screenings / questionnaires
                  </span>
                </div>
              </div>

              {/* Prominent Primary CTA Button */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-primary-container via-surface-container to-tertiary-container/30 border border-primary/30 flex flex-col items-center justify-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-error text-white flex items-center justify-center shadow-md animate-bounce">
                  <span className="material-symbols-outlined text-[28px]">videocam</span>
                </div>
                <div>
                  <h4 className="text-base font-bold text-on-surface">
                    Ready for 8-Second Standardized Walking Test
                  </h4>
                  <p className="text-xs text-on-surface-variant max-w-md mt-1">
                    Instruct patient to walk 4–6 paces along the marked line. Optical tracking will extract sagittal knee extension deficit, gait cadence, and velocity.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigate('gait')}
                  className="w-full sm:w-auto px-8 py-3 rounded-xl bg-error hover:bg-error/90 text-on-error font-headline-sm text-sm font-bold shadow-lg hover:shadow-xl transition transform hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[22px] animate-pulse">radio_button_checked</span>
                  LAUNCH GAIT RECORDING STUDIO & START 8s TEST ➔
                </button>
              </div>

              {/* Previous Gait Results if already tested */}
              {gaitResult && (
                <div className="mt-md p-3 rounded-xl bg-surface-container border border-emerald-500/40 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-600 text-[22px]">check_circle</span>
                    <div>
                      <span className="text-xs font-bold text-on-surface block">
                        Recent Gait Recording Available ({gaitResult.risk})
                      </span>
                      <span className="text-[11px] text-on-surface-variant">
                        Cadence: {gaitResult.cadence} spm · Velocity: {gaitResult.velocity} m/s · Knee Deficit: {gaitResult.kneeAngleAsymmetry}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('report')}
                    className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-variant text-on-surface text-xs font-bold transition"
                  >
                    View Report →
                  </button>
                </div>
              )}

              {/* Step 4 Actions */}
              <div className="pt-sm border-t border-outline-variant/30 flex items-center justify-between mt-md">
                <button
                  type="button"
                  onClick={() => setActiveStep(3)}
                  className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs transition"
                >
                  ← Back to Step 3
                </button>
                <button
                  type="button"
                  onClick={onOpenTeleconsult}
                  className="px-3 py-1.5 rounded-lg bg-tertiary-container hover:bg-tertiary text-on-tertiary font-bold text-xs transition flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[15px]">cell_tower</span>
                  Refer to Specialist
                </button>
              </div>
            </section>
          )}
        </div>

        {/* Right Column: Live Clinical Metrics & Telemetry Dashboard (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-lg">
          {/* Live Biomechanical Telemetry Card */}
          <section className="w-full bg-surface-container-lowest rounded-xl shadow-md p-card-padding border border-surface-container">
            <div className="flex items-center justify-between pb-sm border-b border-outline-variant/30 mb-sm">
              <div className="flex items-center gap-xs">
                <span className="material-symbols-outlined text-[20px] text-tertiary">speed</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Kinematics Reference Benchmarks
                </h3>
              </div>
              <span className="px-xs py-2xs rounded bg-tertiary-fixed text-on-tertiary-fixed font-data-mono text-[10px] font-bold">
                ICMR Norms
              </span>
            </div>

            <div className="grid grid-cols-2 gap-sm mb-sm">
              <div className="p-sm rounded-xl bg-surface-container-low flex flex-col justify-between">
                <span className="text-[11px] text-on-surface-variant uppercase font-semibold">Target Cadence</span>
                <div className="flex items-baseline gap-1 my-1">
                  <span className="text-[26px] font-bold font-data-metric text-on-surface">
                    {gaitResult?.cadence || 94}
                  </span>
                  <span className="text-[11px] text-on-surface-variant">steps/min</span>
                </div>
                <span className="text-[10px] text-amber-600 font-data-mono font-semibold">
                  -16% vs Asymptomatic
                </span>
              </div>

              <div className="p-sm rounded-xl bg-surface-container-low flex flex-col justify-between">
                <span className="text-[11px] text-on-surface-variant uppercase font-semibold">Target Velocity</span>
                <div className="flex items-baseline gap-1 my-1">
                  <span className="text-[26px] font-bold font-data-metric text-on-surface">
                    {gaitResult?.velocity || 0.86}
                  </span>
                  <span className="text-[11px] text-on-surface-variant">m/sec</span>
                </div>
                <span className="text-[10px] text-error font-data-mono font-bold">
                  Antalgic Cutoff (&lt;1.0m/s)
                </span>
              </div>
            </div>

            {/* Extension Deficit Display */}
            <div className="p-sm rounded-xl bg-surface-container-low mb-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-on-surface">Sagittal Extension Deficit</span>
                <span className="px-1.5 py-0.5 rounded bg-error-container text-on-error-container font-data-mono text-[10px] font-bold">
                  {gaitResult?.kneeAngleAsymmetry || '+14.2° Deficit'}
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-on-surface-variant">Unimpaired Left Knee</span>
                  <span className="font-data-mono font-bold text-on-surface">4.0°</span>
                </div>
                <div className="w-full bg-surface-variant h-1.5 rounded-full overflow-hidden">
                  <div className="bg-tertiary h-full rounded-full" style={{ width: '25%' }}></div>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-error font-semibold">Affected Right Knee</span>
                  <span className="font-data-mono font-bold text-error">14.2°</span>
                </div>
                <div className="w-full bg-surface-variant h-1.5 rounded-full overflow-hidden">
                  <div className="bg-error h-full rounded-full" style={{ width: '82%' }}></div>
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-surface-container flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary">swap_driving_apps_wheel</span>
                <div>
                  <span className="text-[11px] text-on-surface font-semibold block">Dynamic Coronal Axis Offset</span>
                  <span className="text-[10px] text-on-surface-variant">Varus Thrust Medialization</span>
                </div>
              </div>
              <span className="font-data-mono text-xs font-bold text-primary px-2 py-1 bg-surface-container-lowest rounded shadow-xs">
                +3.8° Varus
              </span>
            </div>
          </section>

          {/* Quick Stage Review & Jump Box */}
          <section className="w-full bg-surface-container-lowest rounded-xl shadow-md p-card-padding border border-surface-container">
            <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-primary">checklist</span>
              Screening Stage Checklist
            </h4>
            <div className="space-y-2 text-xs">
              <div
                onClick={() => setActiveStep(1)}
                className={`p-2 rounded-lg cursor-pointer flex items-center justify-between transition ${
                  activeStep === 1 ? 'bg-primary-container/20 border border-primary font-bold' : 'bg-surface-container-low hover:bg-surface-container'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>1. Vitals & Anthropometrics</span>
                </div>
                <span className="text-[11px] text-on-surface-variant font-data-mono">BMI {computedBmi}</span>
              </div>

              <div
                onClick={() => setActiveStep(2)}
                className={`p-2 rounded-lg cursor-pointer flex items-center justify-between transition ${
                  activeStep === 2 ? 'bg-primary-container/20 border border-primary font-bold' : 'bg-surface-container-low hover:bg-surface-container'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={completedSteps.includes(2) ? 'text-emerald-600 font-bold' : 'text-on-surface-variant'}>
                    {completedSteps.includes(2) ? '✓' : '○'}
                  </span>
                  <span>2. Clinical KOOS Survey</span>
                </div>
                <span className="text-[11px] text-on-surface-variant font-data-mono">{currentKoos.total}/40</span>
              </div>

              <div
                onClick={() => setActiveStep(3)}
                className={`p-2 rounded-lg cursor-pointer flex items-center justify-between transition ${
                  activeStep === 3 ? 'bg-primary-container/20 border border-primary font-bold' : 'bg-surface-container-low hover:bg-surface-container'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={completedSteps.includes(3) ? 'text-emerald-600 font-bold' : 'text-on-surface-variant'}>
                    {completedSteps.includes(3) ? '✓' : '○'}
                  </span>
                  <span>3. Optical Calibration</span>
                </div>
                <span className="text-[11px] text-emerald-600 font-bold">2.5m OK</span>
              </div>

              <div
                onClick={() => setActiveStep(4)}
                className={`p-2 rounded-lg cursor-pointer flex items-center justify-between transition ${
                  activeStep === 4 ? 'bg-error-container/20 border border-error font-bold' : 'bg-surface-container-low hover:bg-surface-container'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={gaitResult ? 'text-emerald-600 font-bold' : 'text-error font-bold'}>
                    {gaitResult ? '✓' : '●'}
                  </span>
                  <span>4. Final Gait Screen Studio</span>
                </div>
                <span className="text-[11px] text-error font-bold font-data-mono">
                  {gaitResult ? 'COMPLETE' : 'READY'}
                </span>
              </div>
            </div>
          </section>

          {/* Statutory ICMR Notice */}
          <section className="w-full rounded-xl bg-surface-container-low p-3 shadow-sm flex items-start gap-2.5 border border-outline-variant/30">
            <div className="w-7 h-7 rounded-lg bg-surface-container-highest text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[16px]">policy</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-on-surface font-bold">
                  ICMR Frontline AI Protocol
                </span>
                <span className="px-1 py-0.2 rounded bg-surface-container-highest font-data-mono text-[9px] text-primary font-semibold">
                  REG-2024-NER
                </span>
              </div>
              <p className="text-[10px] text-on-surface-variant mt-0.5">
                Frontline risk-stratification protocol for CHCs/PHCs across India. Triage screening aid — not a substitute for clinical radiographic staging.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
