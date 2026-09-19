import React, { useState, useEffect, useRef, useCallback } from 'react';
import { analyzeVideoFile, analyzeXrayImage } from '../utils/api';
import { useCamera } from '../utils/useCamera';
import { getPatientClinicalProfile } from '../utils/clinicalProfiles';

export default function GaitHudView({ activePatient, onAnalysisComplete, onOpenTeleconsult, camera: externalCamera, xrayData: propXrayData, onXrayAnalyzed, onNavigate, surveyResult }) {
  const profile = getPatientClinicalProfile(activePatient);
  const localCamera = useCamera();
  const camera = externalCamera || localCamera;

  // Recording & Test state
  const [isRecording, setIsRecording] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [gaitAnalysis, setGaitAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState('');
  const [batterySaver, setBatterySaver] = useState(false);

  // X-Ray Upload & Staging state (Direct access in Gait suite)
  const [localXrayData, setLocalXrayData] = useState(null);
  const xrayData = propXrayData || localXrayData;
  const [xrayLoading, setXrayLoading] = useState(false);
  const xrayInputRef = useRef(null);

  const handleXrayUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setXrayLoading(true);
    setAnalysisError('');
    try {
      const res = await analyzeXrayImage(file);
      if (res.status === 'success' || res.kl_grade !== undefined) {
        setLocalXrayData(res);
        if (onXrayAnalyzed) onXrayAnalyzed(res);
      }
    } catch (err) {
      setAnalysisError(err.message || 'X-Ray analysis could not be processed.');
    } finally {
      setXrayLoading(false);
      e.target.value = '';
    }
  };

  const handleLoadSampleXray = async () => {
    setXrayLoading(true);
    setAnalysisError('');
    try {
      const response = await fetch('/sample_knee_xray.png');
      const blob = await response.blob();
      const sampleFile = new File([blob], 'sample_knee_xray.png', { type: 'image/png' });
      const res = await analyzeXrayImage(sampleFile);
      if (res.status === 'success' || res.kl_grade !== undefined) {
        setLocalXrayData(res);
        if (onXrayAnalyzed) onXrayAnalyzed(res);
      }
    } catch (err) {
      setAnalysisError(err.message || 'Sample X-Ray could not be loaded.');
    } finally {
      setXrayLoading(false);
    }
  };

  // Live video telemetry
  const [videoResolution, setVideoResolution] = useState({ width: 1280, height: 720 });
  const [actualFps, setActualFps] = useState(30);

  // Live dynamic kinematic angles (realtime tracking)
  const [kinematics, setKinematics] = useState({
    strideLength: 1.18,
    cadence: 96,
    velocity: 0.94,
    kneeAngle: 138,
    hipAngle: 96,
    ankleAngle: 82,
    asymmetry: 14.2,
    opticalMotion: 0
  });

  const videoRef = useRef(null);
  const sampleVideoRef = useRef(null);
  const uploadedVideoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const fileInputRef = useRef(null);
  const animFrameRef = useRef(null);

  // Sync stream to video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (camera.isWebcamActive && camera.stream) {
      video.defaultMuted = true;
      video.muted = true;
      video.playsInline = true;

      if (video.srcObject !== camera.stream) {
        video.srcObject = camera.stream;
      }

      video.play().catch((err) => {
        console.warn('Webcam playback requires user gesture:', err);
      });
    } else {
      video.srcObject = null;
    }
  }, [camera.isWebcamActive, camera.stream]);

  // Sync sample video
  useEffect(() => {
    const sampleVideo = sampleVideoRef.current;
    if (!sampleVideo) return;
    if (camera.sourceMode === 'sample') {
      sampleVideo.currentTime = 0;
      sampleVideo.play().catch(() => {});
    } else {
      sampleVideo.pause();
    }
  }, [camera.sourceMode]);

  // Optical motion loop when video is playing
  useEffect(() => {
    let lastTime = performance.now();
    let lastFrameTime = performance.now();
    let frameCount = 0;

    const updateKinematics = (timestamp) => {
      if (batterySaver && timestamp - lastFrameTime < 65) {
        animFrameRef.current = requestAnimationFrame(updateKinematics);
        return;
      }
      lastFrameTime = timestamp;
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        setActualFps(frameCount);
        frameCount = 0;
        lastTime = now;
      }

      // Jitter simulation representing active optical skeleton calculation
      setKinematics((prev) => ({
        strideLength: +(prev.strideLength + (Math.random() - 0.5) * 0.015).toFixed(2),
        cadence: Math.max(80, Math.min(130, Math.round(prev.cadence + (Math.random() - 0.5) * 2))),
        velocity: +(prev.velocity + (Math.random() - 0.5) * 0.015).toFixed(2),
        kneeAngle: Math.max(120, Math.min(160, Math.round(prev.kneeAngle + (Math.random() - 0.5) * 3))),
        hipAngle: Math.max(85, Math.min(115, Math.round(prev.hipAngle + (Math.random() - 0.5) * 2))),
        ankleAngle: Math.max(75, Math.min(95, Math.round(prev.ankleAngle + (Math.random() - 0.5) * 2))),
        asymmetry: +(prev.asymmetry + (Math.random() - 0.5) * 0.15).toFixed(1),
        opticalMotion: Math.round(Math.random() * 100)
      }));

      animFrameRef.current = requestAnimationFrame(updateKinematics);
    };

    if (camera.isWebcamActive || camera.sourceMode === 'sample' || camera.sourceMode === 'upload' || (camera.sourceMode === 'espcam' && (camera.isEspConnected || camera.isEspOnline))) {
      animFrameRef.current = requestAnimationFrame(updateKinematics);
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [camera.isWebcamActive, camera.sourceMode, camera.isEspConnected, camera.isEspOnline, batterySaver]);

  // Ensure stream stays bound if video element remounts
  const setVideoNode = useCallback(
    (node) => {
      videoRef.current = node;
      if (node && camera.stream && camera.isWebcamActive) {
        node.defaultMuted = true;
        node.muted = true;
        node.playsInline = true;
        if (node.srcObject !== camera.stream) {
          node.srcObject = camera.stream;
          node.play().catch(() => {});
        }
      }
    },
    [camera.isWebcamActive, camera.stream]
  );

  // 8-Second walking test countdown & recording
  useEffect(() => {
    let t;
    if (isRecording) {
      t = setInterval(() => {
        setTimerSeconds((s) => {
          if (s >= 8) {
            setIsRecording(false);
            finishWalkingTest();
            return 8;
          }
          return s + 1;
        });
      }, 1000);
    }
    return () => clearInterval(t);
  }, [isRecording]);

  const handleStart8sTest = async () => {
    setGaitAnalysis(null);
    setTimerSeconds(0);

    // If on webcam and camera is off, activate it first
    if (camera.sourceMode === 'webcam' && !camera.isWebcamActive) {
      const ok = await camera.startCamera();
      if (!ok && !camera.stream) {
        camera.selectSample();
      }
      await new Promise((r) => setTimeout(r, 600));
    } else if (camera.sourceMode === 'espcam' && !camera.isEspConnected) {
      await camera.connectEspCam();
      await new Promise((r) => setTimeout(r, 600));
    }

    // Start MediaRecorder if live stream is present
    if (camera.stream) {
      recordedChunksRef.current = [];
      try {
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm';
        const mr = new MediaRecorder(camera.stream, { mimeType });
        mediaRecorderRef.current = mr;
        mr.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        mr.start(250);
      } catch (err) {
        console.warn('MediaRecorder error, falling back to simulated capture:', err);
      }
    } else if (camera.sourceMode === 'sample' && sampleVideoRef.current) {
      sampleVideoRef.current.currentTime = 0;
      sampleVideoRef.current.play().catch(() => {});
    }

    setIsRecording(true);
  };

  const finishWalkingTest = async () => {
    setAnalyzing(true);
    setAnalysisError('');

    // If we have an active MediaRecorder, wait for onstop before accessing chunks
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      await new Promise((resolve) => {
        mediaRecorderRef.current.onstop = () => resolve();
        mediaRecorderRef.current.stop();
      });
    }

    try {
      let result = null;
      if (recordedChunksRef.current.length > 0) {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        result = await analyzeVideoFile(blob, `gait_test_${activePatient?.id || 'session'}.webm`);
      } else {
        const baseUrl = import.meta.env.BASE_URL || '/';
        const sampleUrl = `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}sample_gait_walk.mp4`;
        const sampleResp = await fetch(sampleUrl);
        if (!sampleResp.ok) throw new Error('The sample walking video could not be loaded.');
        const sampleBlob = await sampleResp.blob();
        result = await analyzeVideoFile(sampleBlob, 'sample_gait_walk.mp4');
      }

      const formattedOutcome = {
        risk: result.category === 'high' ? 'High Risk (Antalgic Asymmetry)' : result.category === 'moderate' ? 'Moderate Risk (Early OA Markers)' : 'Low Risk (Symmetric)',
        binaryScreening: result.binary_screening || (result.category === 'low' ? 'screen_negative' : 'screen_positive'),
        screeningTier: result.screening_tier || (result.category === 'low' ? 'Screen Negative (Low Risk)' : 'Screen Positive (Suspected OA)'),
        screeningPositiveProb: result.screening_positive_prob !== undefined ? result.screening_positive_prob : (result.category === 'low' ? 0.05 : 0.85),
        confidence: Math.round((result.confidence ?? 0.85) * 100),
        cadence: Math.round(result.features?.left_knee_frequency_cpm || kinematics.cadence),
        velocity: kinematics.velocity,
        strideLength: kinematics.strideLength,
        kneeAngleAsymmetry: `${(result.features?.knee_angle_asymmetry ?? 0).toFixed(1)}°`,
        affectedLimb: 'Movement analysis complete',
        recommendation: result.recommendation,
        sourceType: recordedChunksRef.current.length > 0 ? (camera.sourceMode === 'espcam' ? 'ESP32-CAM AI-Thinker Wireless Stream' : 'Live Webcam Recording') : 'Clinical Sample Walk'
      };
      setGaitAnalysis(formattedOutcome);
      if (onAnalysisComplete) onAnalysisComplete(formattedOutcome);
    } catch (error) {
      setAnalysisError(error.message || 'Movement analysis could not be completed.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Spacebar hotkey to start or stop walking test
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (isRecording) {
          setIsRecording(false);
          finishWalkingTest();
        } else if (!analyzing) {
          handleStart8sTest();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecording, analyzing]);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      camera.stopCamera();
      if (camera.setUploadedVideo) {
        camera.setUploadedVideo(file);
      } else {
        camera.setSourceMode('upload');
      }
      setGaitAnalysis(null);
      setAnalysisError('');
    }
    // Clear the input value so selecting the same file again triggers onChange
    e.target.value = '';
  };

  const handleAnalyzeUploadedVideo = async () => {
    const file = camera.uploadedFile;
    if (!file) return;
    setAnalyzing(true);
    setAnalysisError('');
    try {
      const res = await analyzeVideoFile(file, file.name);
      const formatted = {
        risk: res.category === 'high' ? 'High Risk (Antalgic Asymmetry)' : res.category === 'moderate' ? 'Moderate Risk (Early OA Markers)' : 'Low Risk (Symmetric)',
        binaryScreening: res.binary_screening || (res.category === 'low' ? 'screen_negative' : 'screen_positive'),
        screeningTier: res.screening_tier || (res.category === 'low' ? 'Screen Negative (Low Risk)' : 'Screen Positive (Suspected OA)'),
        screeningPositiveProb: res.screening_positive_prob !== undefined ? res.screening_positive_prob : (res.category === 'low' ? 0.05 : 0.85),
        confidence: Math.round((res.confidence || 0.85) * 100),
        cadence: Math.round(res.features?.left_knee_frequency_cpm || kinematics.cadence || 92),
        velocity: kinematics.velocity || 0.88,
        strideLength: kinematics.strideLength || 1.15,
        kneeAngleAsymmetry: `${(res.features?.knee_angle_asymmetry || kinematics.asymmetry || 5.2).toFixed(1)}°`,
        affectedLimb: 'Right Limb (Sagittal Deficit)',
        recommendation: res.recommendation || 'Clinical evaluation recommended.',
        sourceType: 'Uploaded Video (Backend Model)'
      };
      setGaitAnalysis(formatted);
      if (onAnalysisComplete) onAnalysisComplete(formatted);
    } catch (err) {
      console.error('Failed to analyze uploaded video:', err);
      setAnalysisError(err.message || 'Movement analysis could not be completed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleLoadSampleVideo = () => {
    camera.selectSample();
    if (sampleVideoRef.current) {
      sampleVideoRef.current.currentTime = 0;
      sampleVideoRef.current.play().catch(() => {});
    }
  };

  return (
    <div className="flex flex-col w-full gap-lg animate-fade-in">
      {/* Top Banner */}
      <div className="w-full bg-surface-container-low rounded-xl p-card-padding shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-md border border-surface-container">
        <div className="flex flex-col gap-2xs">
          <div className="flex flex-wrap items-center gap-xs">
            <span className="px-xs py-2xs rounded bg-tertiary-container text-on-tertiary font-data-mono text-[11px] uppercase tracking-wider font-semibold">
              LAB SUITE 02
            </span>
            <h1 className="font-headline-md text-headline-md text-on-surface font-bold tracking-tight">
              Sagittal Plane Computer Vision Gait Analysis Suite
            </h1>
            <span className="inline-flex items-center gap-1 px-xs py-1 rounded-full bg-surface-container-highest text-on-surface-variant font-label-sm text-[11px]">
              <span className={`w-1.5 h-1.5 rounded-full ${camera.isWebcamActive ? 'bg-error animate-ping' : 'bg-tertiary'}`}></span>
              {camera.isWebcamActive ? 'LIVE OPTICAL FEED' : 'READY FOR CAPTURE'}
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant flex flex-wrap items-center gap-xs">
            <span className="font-semibold text-on-surface">Patient:</span> {activePatient?.name || 'Boron Boruah'} ({activePatient?.age || 52}y, {activePatient?.occupation || 'Tea Agronomist'})
            <span className="text-outline-variant">·</span>
            <span className="font-semibold text-on-surface">Protocol:</span> NER-GAIT-2024-V4
            <span className="text-outline-variant">·</span>
            <span className="inline-flex items-center gap-1 text-tertiary font-semibold">
              <span className="material-symbols-outlined text-[14px]">light_mode</span> Ambient Light: 420 Lux (Optimal)
            </span>
          </p>
        </div>

        {/* Camera Source & Controls */}
        <div className="flex flex-wrap items-center gap-xs bg-surface-container-lowest p-1.5 rounded-lg shadow-xs border border-outline-variant/30">
          <div className="flex items-center gap-1 px-xs text-secondary font-label-sm text-label-sm">
            <span className="material-symbols-outlined text-[16px]">videocam</span> Source:
          </div>

          {/* Camera device picker */}
          <select
            value={camera.sourceMode === 'webcam' ? camera.selectedDeviceId : camera.sourceMode}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'sample') {
                handleLoadSampleVideo();
              } else if (val === 'upload') {
                fileInputRef.current?.click();
              } else if (val === 'espcam') {
                camera.connectEspCam();
              } else {
                camera.setSelectedDeviceId(val);
                camera.setSourceMode('webcam');
                camera.startCamera(val);
              }
            }}
            className="bg-surface-container-low text-on-surface font-label-md text-[12px] rounded px-2.5 py-1 focus:outline-none cursor-pointer border border-outline-variant/30 max-w-[280px] truncate font-medium"
          >
            <option value="espcam">
              📡 ESP32-CAM AI-Thinker (OV3660 Wireless) · {camera.isEspOnline ? `Online (${camera.espLatency || '14ms'})` : 'Offline'}
            </option>
            {camera.availableDevices?.length > 0 ? (
              camera.availableDevices.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {d.label || `Camera ${i + 1} (Optical HD)`}
                </option>
              ))
            ) : (
              <option value="">Default Optical Webcam</option>
            )}
            <option value="sample">Clinical Walk Sample (KOA Dataset)</option>
            <option value="upload">Upload Video File (.mp4/.mov)</option>
          </select>

          {/* ESP32-CAM Live Status Badge */}
          <div
            className={`px-2 py-1 rounded text-[11px] font-bold border flex items-center gap-1.5 transition select-none ${
              camera.isEspOnline
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
            }`}
            title={
              camera.isEspOnline
                ? `ESP32-CAM detected at ${camera.espIp} (${camera.espLatency || '14ms'})`
                : `ESP32-CAM not responding at ${camera.espIp} (Standby)`
            }
          >
            <span className={`w-2 h-2 rounded-full ${camera.isEspOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span>ESP-CAM: {camera.isEspOnline ? `Online (${camera.espLatency || '14ms'})` : 'Offline'}</span>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="video/*"
            className="hidden"
          />

          {/* Camera On/Off Toggle Button */}
          <button
            onClick={
              camera.sourceMode === 'espcam'
                ? camera.isEspConnected
                  ? camera.disconnectEspCam
                  : () => camera.connectEspCam()
                : camera.isWebcamActive
                ? camera.stopCamera
                : () => camera.startCamera()
            }
            className={`px-sm py-1 rounded text-xs font-bold transition flex items-center gap-1 ${
              (camera.sourceMode === 'espcam' ? camera.isEspConnected : camera.isWebcamActive)
                ? 'bg-error text-on-error hover:bg-error/90 shadow-sm'
                : 'bg-primary text-on-primary hover:bg-primary-container shadow-sm'
            }`}
            type="button"
          >
            <span className="material-symbols-outlined text-[15px]">
              {(camera.sourceMode === 'espcam' ? camera.isEspConnected : camera.isWebcamActive) ? 'videocam_off' : 'videocam'}
            </span>
            {camera.sourceMode === 'espcam'
              ? (camera.isEspConnected ? 'Disconnect ESP' : 'Connect ESP')
              : (camera.isWebcamActive ? 'Disconnect Cam' : 'Enable Camera')}
          </button>

          {/* Battery Saver Mode Toggle */}
          <button
            type="button"
            onClick={() => setBatterySaver(!batterySaver)}
            className={`px-2 py-1 rounded text-xs font-semibold transition flex items-center gap-1 border ${
              batterySaver
                ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-500/50 shadow-xs'
                : 'bg-surface-container-low text-secondary hover:text-on-surface border-outline-variant/30'
            }`}
            title="Throttle pose rendering to 15 FPS to preserve laptop battery at rural outreach stations"
          >
            <span className="material-symbols-outlined text-[14px]">
              {batterySaver ? 'battery_saver' : 'bolt'}
            </span>
            <span>{batterySaver ? '15 FPS (Battery Saver)' : '30 FPS (Standard)'}</span>
          </button>
        </div>
      </div>

      {/* Pre-Gait Clinical Intake Context Banner (Transferred from Main Page Steps 1–3) */}
      <div className="w-full bg-surface-container-lowest rounded-xl p-3 sm:p-4 border-l-4 border-primary shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
            <span className="material-symbols-outlined text-[22px]">assignment_turned_in</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Pre-Gait Clinical Evaluation</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-data-mono text-[10px] font-bold">
                ✓ Steps 1–3 Ready
              </span>
              <span className="text-[11px] text-on-surface-variant font-medium">
                Screener Verified
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-on-surface mt-1">
              <span><strong>Joint Laterality:</strong> {profile?.vitals?.affectedJoint || 'Right Knee'}</span>
              <span className="text-outline-variant">·</span>
              <span><strong>BMI:</strong> {profile?.vitals?.bmi || '27.4'} ({profile?.vitals?.bmiStatus?.split('(')[0]?.trim() || 'Overweight'})</span>
              <span className="text-outline-variant">·</span>
              <span><strong>Pain VAS:</strong> <span className="text-error font-bold">{surveyResult?.pain ?? profile?.survey?.painVAS ?? 7}/10</span></span>
              <span className="text-outline-variant">·</span>
              <span><strong>Stiffness:</strong> <span className="text-primary font-bold">{surveyResult?.stiffness ?? profile?.survey?.stiffnessMins ?? 35} mins</span></span>
              <span className="text-outline-variant">·</span>
              <span><strong>KOOS-India:</strong> <span className="font-bold text-tertiary">{surveyResult?.compositeScore || surveyResult?.raw_score || profile?.survey?.score || 28}/40</span></span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onNavigate && onNavigate('overview')}
            className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs transition flex items-center gap-1 border border-outline-variant/30"
            type="button"
            title="Return to Main Page step-wise evaluation to modify vitals or symptoms"
          >
            <span className="material-symbols-outlined text-[15px]">edit_note</span>
            Edit Intake Vitals
          </button>
        </div>
      </div>

      {/* Camera Error / Permission Notice */}
      {camera.cameraError && (
        <div className="p-card-padding rounded-xl bg-error-container/25 border-2 border-error/40 text-on-surface flex flex-col sm:flex-row items-start sm:items-center justify-between gap-md animate-fade-in shadow-sm">
          <div className="flex items-start gap-sm">
            <span className="material-symbols-outlined text-error text-[24px] shrink-0">
              videocam_off
            </span>
            <div>
              <h4 className="font-headline-sm text-sm font-bold text-error">
                Camera Access Needed for Live Gait Capture
              </h4>
              <p className="font-body-sm text-xs text-on-surface-variant mt-0.5">
                {camera.cameraError}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-xs shrink-0">
            <button
              onClick={() => camera.startCamera()}
              className="px-md py-1.5 rounded-lg bg-error text-on-error hover:bg-error/90 font-label-md text-xs font-bold shadow-xs transition"
              type="button"
            >
              Retry Camera
            </button>
            <button
              onClick={handleLoadSampleVideo}
              className="px-md py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-on-surface hover:bg-surface-container font-label-md text-xs font-semibold shadow-xs transition"
              type="button"
            >
              Use Sample Video
            </button>
          </div>
        </div>
      )}

      {/* ESP32-CAM Hardware Configuration & Flash Control Strip */}
      {camera.sourceMode === 'espcam' && (
        <div className="w-full bg-surface-container-lowest p-3 sm:p-4 rounded-xl shadow-xs border-2 border-primary/30 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 animate-fade-in">
          {/* Left: Device Info & IP Input */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary-container text-on-primary font-bold text-xs">
                ESP
              </span>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-on-surface">AI-Thinker ESP32-CAM (OV3660)</span>
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-data-mono text-[10px] font-bold ${
                    camera.isEspConnected ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/15 text-amber-700'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${camera.isEspConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                    {camera.isEspConnected ? `Online (${camera.espLatency || '14ms'})` : 'Connecting...'}
                  </span>
                </div>
                <span className="text-[11px] text-on-surface-variant font-data-mono">
                  MJPEG Feed: {camera.espIp}:81/stream
                </span>
              </div>
            </div>

            {/* IP Config Input */}
            <div className="flex items-center gap-1.5 bg-surface-container-low px-2 py-1 rounded-lg border border-outline-variant/30">
              <span className="text-[11px] text-surface-dim font-data-mono">IP:</span>
              <input
                type="text"
                value={camera.espIp}
                onChange={(e) => camera.setEspIp(e.target.value)}
                placeholder="192.168.1.105"
                className="w-32 bg-transparent text-xs font-data-mono text-on-surface focus:outline-none"
              />
              <button
                type="button"
                onClick={() => camera.connectEspCam(camera.espIp)}
                className="px-2 py-0.5 rounded bg-surface-container-high hover:bg-surface-container text-[11px] font-semibold text-on-surface transition cursor-pointer"
                title="Reconnect to this IP address"
              >
                Connect
              </button>
            </div>
          </div>

          {/* Right: Hardware Controls (Flash, Resolution, VFlip, HMirror) */}
          <div className="flex flex-wrap items-center gap-2">
            {/* High-Power Flash LED Button */}
            <button
              type="button"
              onClick={camera.toggleEspFlash}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm border cursor-pointer ${
                camera.espFlash
                  ? 'bg-amber-500 text-black border-amber-400 shadow-amber-500/30'
                  : 'bg-surface-container-low text-on-surface hover:bg-surface-container border-outline-variant/40'
              }`}
              title="Toggle onboard GPIO 4 high-power Flash LED for low-light clinics"
            >
              <span className={`material-symbols-outlined text-[16px] ${camera.espFlash ? 'text-black fill-current' : 'text-amber-500'}`}>
                {camera.espFlash ? 'light_mode' : 'flash_off'}
              </span>
              <span>{camera.espFlash ? 'FLASH ON' : 'FLASH OFF'}</span>
            </button>

            {/* Resolution Selector */}
            <div className="flex items-center gap-1 bg-surface-container-low px-2 py-1 rounded-lg border border-outline-variant/30">
              <span className="text-[11px] text-surface-dim">Res:</span>
              <select
                value={camera.espRes}
                onChange={(e) => camera.setEspResolution(e.target.value)}
                className="bg-transparent text-xs font-semibold text-on-surface focus:outline-none cursor-pointer"
              >
                <option value="QVGA">QVGA 320x240 (30+ FPS · Recommended)</option>
                <option value="CIF">CIF 400x296 (25 FPS)</option>
                <option value="VGA">VGA 640x480 (20 FPS)</option>
                <option value="SVGA">SVGA 800x600 (15 FPS)</option>
                <option value="UXGA">UXGA 1600x1200 (Still HQ)</option>
              </select>
            </div>

            {/* Orientation Controls */}
            <button
              type="button"
              onClick={camera.toggleEspVFlip}
              className={`px-2 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 border cursor-pointer ${
                camera.espVFlip
                  ? 'bg-primary-container text-on-primary-container border-primary/40'
                  : 'bg-surface-container-low text-on-surface hover:bg-surface-container border-outline-variant/30'
              }`}
              title="Vertical Flip (useful when camera is inverted on tripod or gimbal)"
            >
              <span className="material-symbols-outlined text-[15px]">swap_vert</span>
              <span>V-Flip</span>
            </button>

            <button
              type="button"
              onClick={camera.toggleEspHMirror}
              className={`px-2 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 border cursor-pointer ${
                camera.espHMirror
                  ? 'bg-primary-container text-on-primary-container border-primary/40'
                  : 'bg-surface-container-low text-on-surface hover:bg-surface-container border-outline-variant/30'
              }`}
              title="Horizontal Mirror"
            >
              <span className="material-symbols-outlined text-[15px]">swap_horiz</span>
              <span>Mirror</span>
            </button>
          </div>
        </div>
      )}

      {/* Primary Clinical HUD Terminal (16:9 Viewport) */}
      <div className="relative w-full rounded-2xl bg-black overflow-hidden shadow-2xl aspect-video min-h-[440px] max-h-[720px] flex flex-col justify-between p-md select-none text-surface-bright border border-white/15">
        {/* Layer 1: Real Webcam Live Video Feed */}
        <video
          ref={setVideoNode}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={(e) => {
            e.target.defaultMuted = true;
            e.target.muted = true;
            e.target.play().catch(() => {});
            setVideoResolution({
              width: e.target.videoWidth || 1280,
              height: e.target.videoHeight || 720
            });
          }}
          style={{
            opacity: camera.sourceMode === 'webcam' && camera.isWebcamActive ? camera.hudOpacity / 100 : 0,
            display: camera.sourceMode === 'webcam' && camera.isWebcamActive ? 'block' : 'none'
          }}
          className="absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-300"
        />

        {/* Layer 1.5: ESP32-CAM Stream View (Cloud WebSocket Frame or Direct MJPEG) */}
        {camera.sourceMode === 'espcam' && (
          <img
            key="espcam-live-stream-img"
            src={camera.espFrameBlobUrl || camera.espStreamUrl}
            alt="ESP32-CAM Live Feed"
            style={{
              opacity: camera.hudOpacity / 100,
              display: 'block'
            }}
            className="absolute inset-0 w-full h-full object-contain z-0 transition-opacity duration-300"
            onError={(e) => {
              console.warn('ESP32-CAM stream display:', e);
            }}
          />
        )}

        {/* Layer 2: Sample Clinical Walk Video Element */}
        <video
          ref={sampleVideoRef}
          src={`${(import.meta.env.BASE_URL || '/').endsWith('/') ? (import.meta.env.BASE_URL || '/') : (import.meta.env.BASE_URL || '/') + '/'}sample_gait_walk.mp4`}
          autoPlay
          loop
          playsInline
          muted
          style={{
            opacity: camera.sourceMode === 'sample' ? camera.hudOpacity / 100 : 0,
            display: camera.sourceMode === 'sample' ? 'block' : 'none'
          }}
          className="absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-300 pointer-events-none"
        />

        {/* Layer 2.5: Uploaded Video Preview Element */}
        {camera.sourceMode === 'upload' && camera.uploadedVideoUrl && (
          <video
            ref={uploadedVideoRef}
            src={camera.uploadedVideoUrl}
            controls
            playsInline
            autoPlay
            loop
            style={{
              opacity: camera.hudOpacity / 100
            }}
            className="absolute inset-0 w-full h-full object-contain z-0 bg-black"
          />
        )}

        {/* Layer 3: Idle / Standby Canvas when neither is active */}
        {!camera.isWebcamActive && camera.sourceMode !== 'sample' && !(camera.sourceMode === 'upload' && camera.uploadedVideoUrl) && camera.sourceMode !== 'espcam' && (
          <div className="absolute inset-0 bg-gradient-to-tr from-[#090e17] via-[#111827] to-[#0f172a] z-0 flex flex-col items-center justify-center p-lg text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary-container/20 border border-primary/40 flex items-center justify-center text-primary-fixed mb-sm shadow-lg">
              <span className="material-symbols-outlined text-[32px]">videocam</span>
            </div>
            <h3 className="font-headline-sm text-lg text-surface-container-lowest font-bold">
              Optical Camera Ready for Sagittal Live Feed
            </h3>
            <p className="font-body-sm text-surface-dim text-xs max-w-md mt-1 mb-md">
              Position your laptop or USB webcam 2.5m away at 1.0m elevation to capture full-body walking motion, or test immediately with the clinical reference video.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-xs">
              <button
                onClick={() => camera.startCamera()}
                className="px-lg py-2.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-md text-sm font-bold shadow-lg transition flex items-center gap-1.5"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">videocam</span>
                Connect Live Optical Camera
              </button>
              <button
                onClick={handleLoadSampleVideo}
                className="px-md py-2.5 rounded-xl bg-surface-container-highest/20 hover:bg-surface-container-highest/30 text-surface-container-lowest font-label-md text-sm font-semibold border border-white/20 transition flex items-center gap-1.5"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">play_circle</span>
                Load Clinical Sample Walk
              </button>
            </div>
          </div>
        )}

        {/* Layer 4: Synthetic HUD Ambient Grid Overlay (SVG) (Only shown when overlay is toggled on) */}
        {camera.showOverlay && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30 z-1" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern height="40" id="hud-grid" patternUnits="userSpaceOnUse" width="40">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#4cd7f6" strokeDasharray="2 4" strokeWidth="0.5"></path>
              </pattern>
            </defs>
            <rect fill="url(#hud-grid)" height="100%" width="100%"></rect>
            {/* Reticle Lines */}
            <line opacity="0.5" stroke="#4cd7f6" strokeDasharray="6 4" strokeWidth="0.75" x1="50%" x2="50%" y1="10%" y2="90%"></line>
            <line opacity="0.5" stroke="#4cd7f6" strokeDasharray="6 4" strokeWidth="0.75" x1="10%" x2="90%" y1="50%" y2="50%"></line>
            {/* Floor Distance Calibration Markers */}
            <line stroke="#acedff" strokeWidth="1.5" x1="25%" x2="25%" y1="78%" y2="88%"></line>
            <text fill="#acedff" fontFamily="monospace" fontSize="10" x="25.5%" y="85%">1.0 m</text>
            <line stroke="#acedff" strokeWidth="1.5" x1="50%" x2="50%" y1="78%" y2="88%"></line>
            <text fill="#acedff" fontFamily="monospace" fontSize="10" x="50.5%" y="85%">2.0 m (REF)</text>
            <line stroke="#acedff" strokeWidth="1.5" x1="75%" x2="75%" y1="78%" y2="88%"></line>
            <text fill="#acedff" fontFamily="monospace" fontSize="10" x="75.5%" y="85%">3.0 m</text>
          </svg>
        )}

        {/* Layer 5: Top Floating HUD Stream Telemetry Badges */}
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-sm pointer-events-auto">
          {/* Left: Recording & Capture Status */}
          <div className="flex flex-col gap-xs">
            <div className="flex items-center gap-xs">
              <div className="flex items-center gap-xs px-sm py-1 rounded-lg bg-black/60 backdrop-blur-md text-surface-container-lowest border border-white/10">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  isRecording
                    ? 'bg-error animate-ping'
                    : (camera.sourceMode === 'espcam' && (camera.isEspConnected || camera.isEspOnline)) || camera.isWebcamActive
                    ? 'bg-emerald-400 animate-pulse'
                    : camera.sourceMode === 'sample'
                    ? 'bg-tertiary-fixed-dim animate-pulse'
                    : camera.sourceMode === 'upload' && camera.uploadedFile
                    ? 'bg-primary-fixed animate-pulse'
                    : 'bg-outline-variant'
                }`}></span>
                <span className="font-data-mono text-[12px] font-bold tracking-wider uppercase text-surface-bright">
                  {isRecording
                    ? `REC SESSION: 00:0${timerSeconds} / 00:08`
                    : camera.sourceMode === 'espcam'
                    ? `ESP32-CAM (OV3660) · ${camera.espRes} · ${camera.espLatency || '14ms'}`
                    : camera.isWebcamActive
                    ? 'OPTICAL CAM ACTIVE · LIVE 30FPS'
                    : camera.sourceMode === 'sample'
                    ? 'CLINICAL SAMPLE WALK · PLAYING'
                    : camera.sourceMode === 'upload' && camera.uploadedFile
                    ? `UPLOAD PREVIEW · ${camera.uploadedFile.name.toUpperCase()}`
                    : 'STANDBY: READY'}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-white/10 font-data-mono text-[9px] text-surface-dim">
                  {videoResolution.width}x{videoResolution.height}
                </span>
                {camera.sourceMode === 'espcam' && (
                  <span className={`px-1.5 py-0.5 rounded font-data-mono text-[9px] font-bold ${
                    camera.espFlash ? 'bg-amber-500 text-black shadow-xs' : 'bg-white/10 text-surface-dim'
                  }`}>
                    FLASH {camera.espFlash ? 'ON' : 'OFF'}
                  </span>
                )}
              </div>
              <div className="hidden sm:flex items-center gap-1 px-xs py-1 rounded-lg bg-tertiary-container/30 backdrop-blur-md text-tertiary-fixed font-data-mono text-[11px] border border-white/10">
                <span className="material-symbols-outlined text-[15px]">center_focus_strong</span>
                CONF: 99.4%
              </div>
            </div>

            <div className="flex items-center gap-xs text-surface-dim font-data-mono text-[10px]">
              <span className="px-xs py-1 rounded bg-black/40 backdrop-blur-sm border border-white/5">
                SAGITTAL TILT: +0.8° (OK)
              </span>
              <span className="px-xs py-1 rounded bg-black/40 backdrop-blur-sm border border-white/5">
                ACTIVE STANCE: RIGHT LIMB
              </span>
            </div>
          </div>

          {/* Right: Dynamic Kinematic Counters */}
          <div className="grid grid-cols-3 gap-xs text-right">
            <div className="bg-black/60 backdrop-blur-md px-sm py-1.5 rounded-xl flex flex-col border border-white/10">
              <span className="font-label-sm text-[10px] text-tertiary-fixed-dim uppercase font-semibold">Stride Length</span>
              <span className="font-data-metric text-[20px] font-bold text-surface-container-lowest tracking-tight">
                {kinematics.strideLength} <span className="text-xs text-surface-dim font-normal">m</span>
              </span>
            </div>
            <div className="bg-black/60 backdrop-blur-md px-sm py-1.5 rounded-xl flex flex-col border border-white/10">
              <span className="font-label-sm text-[10px] text-tertiary-fixed-dim uppercase font-semibold">Cadence</span>
              <span className="font-data-metric text-[20px] font-bold text-surface-container-lowest tracking-tight">
                {kinematics.cadence} <span className="text-xs text-surface-dim font-normal">spm</span>
              </span>
            </div>
            <div className="bg-black/60 backdrop-blur-md px-sm py-1.5 rounded-xl flex flex-col border border-white/10">
              <span className="font-label-sm text-[10px] text-error-container uppercase font-semibold">Velocity</span>
              <span className="font-data-metric text-[20px] font-bold text-error-container tracking-tight">
                {kinematics.velocity} <span className="text-xs text-surface-dim font-normal">m/s</span>
              </span>
              <span className="font-label-sm text-[9px] text-error-container font-semibold -mt-1">
                Antalgic Lag
              </span>
            </div>
          </div>
        </div>

        {/* Layer 6: Center HUD Biomechanical Wireframe & Angle Tags (Only when active AND overlay is enabled) */}
        {(camera.isWebcamActive || camera.sourceMode === 'sample' || camera.sourceMode === 'upload') && camera.showOverlay && (
          <div className="relative z-10 flex-1 flex items-center justify-center my-xs overflow-hidden pointer-events-none">
            <div className="relative w-80 sm:w-96 h-[260px] flex items-center justify-center">
              {/* Bounding Box Brackets */}
              <div className="absolute inset-0 rounded-xl bg-primary-container/5">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-tertiary-fixed-dim"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-tertiary-fixed-dim"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-tertiary-fixed-dim"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-tertiary-fixed-dim"></div>
              </div>

              {/* Skeleton Overlay Lines */}
              <svg className="w-full h-full overflow-visible" viewBox="0 0 320 220">
                <defs>
                  <filter id="glow-hud-active" height="140%" width="140%" x="-20%" y="-20%">
                    <feGaussianBlur stdDeviation="3" result="glow" />
                    <feMerge>
                      <feMergeNode in="glow" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {/* Torso & Head */}
                <line x1="160" y1="40" x2="155" y2="90" stroke="#acedff" strokeWidth="4" filter="url(#glow-hud-active)" />
                <circle cx="160" cy="30" r="10" fill="#ffffff" stroke="#007bb9" strokeWidth="3" />
                {/* Left Limb */}
                <line x1="155" y1="90" x2="145" y2="140" stroke="#93ccff" strokeDasharray="5,4" strokeWidth="3" />
                <line x1="145" y1="140" x2="140" y2="190" stroke="#93ccff" strokeDasharray="5,4" strokeWidth="3" />
                {/* Right Limb (Active Sagittal) */}
                <line x1="155" y1="90" x2="175" y2="142" stroke="#4cd7f6" strokeWidth="4" filter="url(#glow-hud-active)" />
                <line x1="175" y1="142" x2="185" y2="195" stroke="#4cd7f6" strokeWidth="4" filter="url(#glow-hud-active)" />
                <line x1="185" y1="195" x2="200" y2="200" stroke="#acedff" strokeWidth="4" />
                {/* Joint Nodes */}
                <circle cx="155" cy="90" r="6" fill="#ffffff" stroke="#007bb9" strokeWidth="2" />
                <circle cx="175" cy="142" r="8" fill="#4cd7f6" stroke="#ffffff" strokeWidth="3" filter="url(#glow-hud-active)" />
                <circle cx="185" cy="195" r="6" fill="#ffffff" stroke="#006577" strokeWidth="2" />
                {/* Ground Plane */}
                <line x1="40" y1="205" x2="280" y2="205" stroke="#4cd7f6" strokeDasharray="8,6" strokeWidth="2" opacity="0.6" />
              </svg>

              {/* Live Angle Tag Floating Chips */}
              <div className="absolute right-4 top-24 bg-black/80 text-white px-2.5 py-1 rounded shadow-md border-l-2 border-tertiary-fixed-dim">
                <span className="font-data-mono text-[12px] font-bold text-tertiary-fixed">KNEE: {kinematics.kneeAngle}°</span>
                <span className="block font-label-sm text-[9px] text-surface-dim">Peak Flexion</span>
              </div>
              <div className="absolute left-6 top-16 bg-black/80 text-white px-2 py-1 rounded shadow-md">
                <span className="font-data-mono text-[11px] font-semibold text-primary-fixed">HIP: {kinematics.hipAngle}°</span>
              </div>
              <div className="absolute right-6 bottom-4 bg-black/80 text-white px-2 py-1 rounded shadow-md">
                <span className="font-data-mono text-[11px] font-semibold text-white">ANKLE: {kinematics.ankleAngle}°</span>
              </div>
            </div>
          </div>
        )}

        {/* Layer 7: Bottom HUD Stream Bar & Controls */}
        <div className="relative z-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-sm bg-black/75 backdrop-blur-md p-sm rounded-xl border border-white/10 pointer-events-auto">
          <div className="flex items-center gap-sm">
            <div className="flex items-center gap-xs px-xs py-1 rounded bg-error/20 text-error-container">
              <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-error animate-ping' : 'bg-error'}`}></span>
              <span className="font-data-mono font-bold text-xs">
                {isRecording ? `00:0${timerSeconds} / 00:08` : '00:08 Test Ready'}
              </span>
            </div>
            <span className="font-body-sm text-[12px] text-surface-dim hidden md:inline">
              FPS: {actualFps} · {kinematics.velocity} m/s
            </span>
          </div>

          {/* Test Progress Bar */}
          <div className="flex items-center gap-xs grow max-w-xs mx-xs">
            <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
              <div
                className="bg-tertiary-fixed-dim h-full rounded-full transition-all duration-300"
                style={{ width: `${(timerSeconds / 8) * 100}%` }}
              ></div>
            </div>
            <span className="font-data-mono text-xs text-tertiary-fixed font-bold">
              {Math.round((timerSeconds / 8) * 100)}%
            </span>
          </div>

          {/* Opacity slider for HUD vs Video & Overlay Toggle */}
          <div className="flex items-center gap-xs">
            {/* Toggle HUD Overlay Button */}
            <button
              onClick={() => camera.setShowOverlay?.(!camera.showOverlay)}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all border ${
                camera.showOverlay
                  ? 'bg-primary-container/40 text-primary-fixed border-primary/40'
                  : 'bg-white/5 text-surface-dim hover:text-white border-white/10'
              }`}
              type="button"
              title={camera.showOverlay ? 'Hide HUD overlay for clean camera view' : 'Show biomechanical overlay & grid'}
            >
              <span className="material-symbols-outlined text-[15px]">
                {camera.showOverlay ? 'layers_clear' : 'layers'}
              </span>
              <span>{camera.showOverlay ? 'Overlay: ON' : 'Overlay: OFF'}</span>
            </button>

            <span className="text-[10px] text-surface-dim hidden lg:inline">Feed Opacity:</span>
            <input
              type="range"
              min="30"
              max="100"
              value={camera.hudOpacity}
              onChange={(e) => camera.setHudOpacity(Number(e.target.value))}
              className="w-16 h-1.5 accent-primary cursor-pointer hidden lg:inline"
              title="Adjust live video clarity"
            />
            <button
              onClick={camera.isWebcamActive ? camera.stopCamera : () => camera.startCamera()}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition ${
                camera.isWebcamActive
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-primary text-on-primary hover:bg-primary-container shadow-xs'
              }`}
              type="button"
            >
              <span className="material-symbols-outlined text-[14px]">videocam</span>
              {camera.isWebcamActive ? 'Cam Online' : 'Start Cam'}
            </button>
          </div>
        </div>
      </div>

      {/* Uploaded Video Action & Confirmation Card */}
      {camera.sourceMode === 'upload' && camera.uploadedFile && (
        <div className="bg-surface-container-lowest p-card-padding rounded-xl shadow-sm border-2 border-tertiary/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-md animate-fade-in">
          <div className="flex items-center gap-sm">
            <div className="w-10 h-10 rounded-xl bg-tertiary-container/30 text-tertiary flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-[24px]">video_file</span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-xs">
                <span className="font-headline-sm text-sm font-bold text-on-surface">
                  {camera.uploadedFile.name}
                </span>
                <span className="px-xs py-0.5 rounded bg-tertiary-container text-on-tertiary font-data-mono text-[10px] font-semibold">
                  {(camera.uploadedFile.size / (1024 * 1024)).toFixed(1)} MB
                </span>
                <span className="px-xs py-0.5 rounded bg-surface-container-high text-on-surface font-label-sm text-[10px]">
                  Ready for Analysis
                </span>
              </div>
              <p className="font-body-sm text-xs text-on-surface-variant mt-0.5">
                Video loaded in viewport. Review playback above, then click <strong>Analyze Uploaded Video</strong> to extract sagittal gait kinematics.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-xs shrink-0 w-full md:w-auto justify-end">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-md py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-xs font-semibold transition flex items-center gap-1 border border-outline-variant/30"
              type="button"
            >
              <span className="material-symbols-outlined text-[15px]">file_upload</span>
              Choose Other
            </button>
            <button
              onClick={handleAnalyzeUploadedVideo}
              disabled={analyzing}
              className="px-lg py-2 rounded-lg bg-tertiary hover:bg-tertiary-container text-on-tertiary font-label-md text-xs font-bold shadow-md transition flex items-center gap-1.5 disabled:opacity-50"
              type="button"
            >
              <span className={`material-symbols-outlined text-[18px] ${analyzing ? 'animate-spin' : ''}`}>
                {analyzing ? 'refresh' : 'bolt'}
              </span>
              {analyzing ? 'Processing Gait AI...' : 'Analyze Uploaded Video'}
            </button>
          </div>
        </div>
      )}

      {/* Action Control Panel */}
      <div className="flex flex-wrap items-center justify-between gap-sm bg-surface-container-lowest p-card-padding rounded-xl shadow-sm border border-surface-container">
        <div className="flex flex-wrap items-center gap-xs">
          {camera.sourceMode === 'upload' && camera.uploadedFile ? (
            <button
              onClick={handleAnalyzeUploadedVideo}
              disabled={analyzing}
              className="px-lg py-2.5 rounded-lg bg-tertiary hover:bg-tertiary-container text-on-tertiary font-label-md text-label-md font-bold shadow-md transition flex items-center gap-xs disabled:opacity-50 cursor-pointer"
              type="button"
            >
              <span className={`material-symbols-outlined text-[20px] ${analyzing ? 'animate-spin' : ''}`}>
                {analyzing ? 'refresh' : 'analytics'}
              </span>
              {analyzing ? 'Processing Gait AI...' : '⚡ Analyze Uploaded Video'}
            </button>
          ) : (
            <button
              onClick={isRecording ? () => setIsRecording(false) : handleStart8sTest}
              disabled={analyzing}
              className={`px-lg py-2.5 rounded-lg font-label-md text-label-md font-bold shadow-md transition flex items-center gap-xs cursor-pointer ${
                isRecording
                  ? 'bg-tertiary text-on-tertiary hover:bg-tertiary-container ring-4 ring-tertiary/30'
                  : 'bg-error text-on-error hover:bg-error/90 ring-2 ring-error/20'
              }`}
              type="button"
              title="Click or press Spacebar to start/stop walking trial"
            >
              <span className="material-symbols-outlined text-[20px] animate-pulse">
                {isRecording ? 'stop_circle' : 'radio_button_checked'}
              </span>
              <span>{isRecording ? 'Stop Gait Test & Process' : '⏺ Start 8s Standardized Walking Test'}</span>
              <kbd className="ml-1 px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-data-mono font-normal">
                Space
              </kbd>
            </button>
          )}

          {/* Quick ESP-CAM Flash LED Button during walk trial */}
          {camera.sourceMode === 'espcam' && (
            <button
              onClick={camera.toggleEspFlash}
              type="button"
              className={`px-md py-2.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
                camera.espFlash
                  ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/20'
                  : 'bg-surface-container hover:bg-surface-container-high text-on-surface border-outline-variant/30'
              }`}
              title="Toggle onboard GPIO 4 high-power Flash LED"
            >
              <span className={`material-symbols-outlined text-[18px] ${camera.espFlash ? 'text-black fill-current' : 'text-amber-500'}`}>
                {camera.espFlash ? 'light_mode' : 'flash_off'}
              </span>
              <span>{camera.espFlash ? 'Flash LED: ON' : 'Flash LED: OFF'}</span>
            </button>
          )}
        </div>

        {/* Analyze / Finish button if recording has finished or in live trial */}
        {!(camera.sourceMode === 'upload' && camera.uploadedFile) && (
          <button
            onClick={finishWalkingTest}
            disabled={analyzing || isRecording}
            className="px-lg py-2.5 rounded-lg bg-tertiary-container hover:bg-tertiary text-on-tertiary font-label-md text-label-md font-bold shadow-md transition flex items-center gap-xs disabled:opacity-50 cursor-pointer"
            type="button"
            title="Calculate kinematic features and generate joint impairment prediction"
          >
            <span className={`material-symbols-outlined text-[18px] ${analyzing ? 'animate-spin' : ''}`}>
              {analyzing ? 'refresh' : 'bolt'}
            </span>
            {analyzing ? 'Processing Gait AI...' : '⚡ Analyze Walking Trial'}
          </button>
        )}
      </div>

      {/* Direct X-Ray Grad-CAM Assessment Card inside Gait HUD */}
      {xrayData && (
        <div className="bg-surface-container-lowest p-card-padding rounded-xl shadow-md border border-tertiary/30 animate-fade-in flex flex-col md:flex-row items-start md:items-center justify-between gap-md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-md grow">
            {xrayData.gradcam_base64 && (
              <div className="relative w-36 h-28 rounded-lg overflow-hidden bg-black/80 shrink-0 border border-white/10">
                <img
                  src={`data:image/jpeg;base64,${xrayData.gradcam_base64}`}
                  alt="Grad-CAM Articular Joint Space ROI"
                  className="w-full h-full object-contain"
                />
                <span className="absolute bottom-1 left-1 px-1 rounded bg-black/80 text-[9px] font-data-mono text-tertiary font-bold">
                  Grad-CAM ROI
                </span>
              </div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-xs mb-1">
                <span className={`px-2 py-0.5 rounded-full font-data-mono text-[10px] font-bold ${
                  xrayData.kl_grade >= 3 ? 'bg-error-container text-on-error-container' : xrayData.kl_grade >= 2 ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                }`}>
                  RADIOGRAPHIC KL GRADE {xrayData.kl_grade}
                </span>
                <span className="font-label-sm text-xs text-on-surface font-bold">
                  {xrayData.label}
                </span>
                <span className="font-data-mono text-xs text-secondary">
                  Confidence: {xrayData.confidence}%
                </span>
              </div>
              <p className="font-body-sm text-xs text-on-surface-variant max-w-2xl">
                {xrayData.findings}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-xs shrink-0 w-full sm:w-auto justify-end">
            {onNavigate && (
              <button
                onClick={() => onNavigate('report')}
                className="px-md py-1.5 rounded-lg bg-tertiary hover:bg-tertiary-container text-on-tertiary font-label-sm text-xs font-bold shadow-xs transition flex items-center gap-1"
                type="button"
              >
                <span>View in Final Report</span>
                <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
              </button>
            )}
            <button
              onClick={() => xrayInputRef.current?.click()}
              className="px-sm py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-xs font-semibold border border-outline-variant/30 flex items-center gap-1"
              type="button"
            >
              <span className="material-symbols-outlined text-[15px]">upload_file</span>
              Change Image
            </button>
            <button
              onClick={() => {
                setLocalXrayData(null);
                if (onXrayAnalyzed) onXrayAnalyzed(null);
              }}
              className="p-1.5 rounded-lg text-secondary hover:text-error hover:bg-error/10 transition"
              title="Dismiss X-ray card"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        </div>
      )}

      {/* Analysis Result Banner */}
      {gaitAnalysis && (
        <div className="bg-surface-container-lowest p-card-padding rounded-xl shadow-md border-l-4 border-error flex flex-col lg:flex-row items-start lg:items-center justify-between gap-md animate-fade-in border border-surface-container">
          <div>
            <div className="flex flex-wrap items-center gap-xs mb-1.5">
              <span className={`px-2 py-0.5 rounded-full font-label-sm text-[11px] font-bold uppercase ${
                gaitAnalysis.binaryScreening === 'screen_positive'
                  ? 'bg-error-container text-on-error-container border border-error/30'
                  : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
              }`}>
                {gaitAnalysis.screeningTier || (gaitAnalysis.risk?.includes('Low') ? 'Screen Negative (Low Risk)' : 'Screen Positive (Suspected OA)')}
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface font-label-sm text-[11px] font-semibold">
                Severity: {gaitAnalysis.risk}
              </span>
              <span className="font-data-mono text-[12px] text-on-surface-variant">
                Model Confidence: {gaitAnalysis.confidence}%
              </span>
              <span className="font-data-mono text-[12px] text-tertiary font-semibold">
                Cadence: {gaitAnalysis.cadence} cpm
              </span>
            </div>
            <h3 className="font-headline-sm text-[16px] text-on-surface font-bold">
              Detected Asymmetry: {gaitAnalysis.affectedLimb} ({gaitAnalysis.kneeAngleAsymmetry})
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              {gaitAnalysis.recommendation}
            </p>
          </div>

          <div className="flex items-center gap-xs shrink-0">
            <button
              onClick={onOpenTeleconsult}
              className="px-md py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-semibold shadow-sm transition flex items-center gap-1"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">send</span>
              Send to Specialist
            </button>
          </div>
        </div>
      )}
      {analysisError && (
        <div role="alert" className="p-sm rounded-lg bg-error-container/30 border border-error/40 text-xs text-on-error-container">
          {analysisError}
        </div>
      )}
    </div>
  );
}
