import React, { useEffect, useRef, useState } from 'react';
import { usePoseTracker } from '../utils/usePoseTracker';

export default function CameraViewport({
  camera,
  isRecording = false,
  timerSeconds = 0,
  kinematics = {
    strideLength: 1.18,
    cadence: 96,
    velocity: 0.94,
    kneeAngle: 138,
    hipAngle: 96,
    ankleAngle: 82
  },
  showControls = true,
  onEnterFullHud,
  aspectRatio = 'aspect-video'
}) {
  const videoRef = useRef(null);
  const sampleVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const [videoDim, setVideoDim] = useState({ w: 1280, h: 720 });
  const [isPlaying, setIsPlaying] = useState(false);

  const activeVideoRef = camera.sourceMode === 'sample' ? sampleVideoRef : videoRef;
  const poseTracker = usePoseTracker({
    videoRef: activeVideoRef,
    canvasRef,
    isActive: camera.isWebcamActive || camera.sourceMode === 'sample',
    showOverlay: camera.showOverlay,
    opacity: camera.hudOpacity
  });

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

      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch((err) => {
            console.warn('Playback need gesture:', err);
            setIsPlaying(false);
          });
      }
    } else {
      video.srcObject = null;
      setIsPlaying(false);
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

  return (
    <div className={`relative w-full rounded-2xl bg-black overflow-hidden shadow-2xl ${aspectRatio} min-h-[380px] max-h-[680px] flex flex-col justify-between p-md select-none text-surface-bright border border-white/15`}>
      {/* 1. Live Camera Stream Video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        crossOrigin="anonymous"
        onLoadedMetadata={(e) => {
          e.target.defaultMuted = true;
          e.target.muted = true;
          e.target.play().catch(() => {});
          setVideoDim({ w: e.target.videoWidth || 1280, h: e.target.videoHeight || 720 });
          setIsPlaying(true);
        }}
        style={{
          opacity: camera.isWebcamActive ? camera.hudOpacity / 100 : 0,
          display: camera.isWebcamActive ? 'block' : 'none'
        }}
        className="absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-300"
      />

      {/* 2. Sample Clinical Walk Reference Video */}
      <video
        ref={sampleVideoRef}
        src={`${(import.meta.env.BASE_URL || '/').replace(/\/$/, '')}/sample_gait_walk.mp4`}
        autoPlay
        loop
        playsInline
        muted
        crossOrigin="anonymous"
        style={{
          opacity: camera.sourceMode === 'sample' ? camera.hudOpacity / 100 : 0,
          display: camera.sourceMode === 'sample' ? 'block' : 'none'
        }}
        className="absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-300 pointer-events-none"
      />

      {/* 2.5. Uploaded Video Preview */}
      {camera.sourceMode === 'upload' && camera.uploadedVideoUrl && (
        <video
          key={camera.uploadedVideoUrl}
          src={camera.uploadedVideoUrl}
          controls
          preload="auto"
          playsInline
          autoPlay
          loop
          crossOrigin="anonymous"
          style={{
            opacity: camera.hudOpacity / 100
          }}
          className="absolute inset-0 w-full h-full object-contain z-0 bg-black"
        />
      )}

      {/* 2.8. Real-Time MediaPipe Leg Marker & Biomechanical Canvas Overlay */}
      <canvas
        ref={canvasRef}
        style={{
          opacity: camera.showOverlay ? camera.hudOpacity / 100 : 0,
          display: (camera.isWebcamActive || camera.sourceMode === 'sample') ? 'block' : 'none'
        }}
        className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none transition-opacity duration-200"
      />

      {/* 3. Inactive Standby Card */}
      {!camera.isWebcamActive && camera.sourceMode !== 'sample' && !(camera.sourceMode === 'upload' && camera.uploadedVideoUrl) && (
        <div className="absolute inset-0 bg-gradient-to-tr from-[#090e17] via-[#111827] to-[#0f172a] z-0 flex flex-col items-center justify-center p-lg text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary-container/20 border border-primary/40 flex items-center justify-center text-primary-fixed mb-sm shadow-xl animate-pulse">
            <span className="material-symbols-outlined text-[34px]">videocam</span>
          </div>
          <h3 className="font-headline-sm text-lg text-surface-container-lowest font-bold">
            Live Optical Camera Standby
          </h3>
          <p className="font-body-sm text-surface-dim text-xs max-w-md mt-1 mb-md">
            Click below to initialize your optical webcam for real-time sagittal posture and knee flexion tracking, or load the clinical walk reference video.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-xs">
            <button
              onClick={() => camera.startCamera()}
              className="px-lg py-2.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-md text-sm font-bold shadow-xl transition-all flex items-center gap-2 active:scale-95"
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">videocam</span>
              Enable Live Camera
            </button>
            <button
              onClick={() => camera.selectSample()}
              className="px-md py-2.5 rounded-xl bg-surface-container-highest/20 hover:bg-surface-container-highest/30 text-surface-container-lowest font-label-md text-sm font-semibold border border-white/20 transition-all flex items-center gap-2 active:scale-95"
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">play_circle</span>
              Sample Clinical Walk
            </button>
          </div>

          {/* Secure context check banner */}
          {!camera.isSecureContext && (
            <div className="mt-md p-2 rounded bg-amber-900/40 border border-amber-500/50 text-amber-200 text-xs flex items-center gap-2 max-w-md">
              <span className="material-symbols-outlined text-[18px]">warning</span>
              <span>Browsing on an IP without HTTPS. Open on <strong>http://localhost:5173</strong> to permit webcam access.</span>
            </div>
          )}
        </div>
      )}

      {/* 4. Reticle & Grid SVG Overlay (Disabled by default during camera usage) */}
      {camera.showOverlay && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30 z-1" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern height="40" id="hud-grid-shared" patternUnits="userSpaceOnUse" width="40">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#4cd7f6" strokeDasharray="2 4" strokeWidth="0.5"></path>
            </pattern>
          </defs>
          <rect fill="url(#hud-grid-shared)" height="100%" width="100%"></rect>
          <line opacity="0.5" stroke="#4cd7f6" strokeDasharray="6 4" strokeWidth="0.75" x1="50%" x2="50%" y1="10%" y2="90%"></line>
          <line opacity="0.5" stroke="#4cd7f6" strokeDasharray="6 4" strokeWidth="0.75" x1="10%" x2="90%" y1="50%" y2="50%"></line>
          <line stroke="#acedff" strokeWidth="1.5" x1="25%" x2="25%" y1="78%" y2="88%"></line>
          <text fill="#acedff" fontFamily="monospace" fontSize="10" x="25.5%" y="85%">1.0 m</text>
          <line stroke="#acedff" strokeWidth="1.5" x1="50%" x2="50%" y1="78%" y2="88%"></line>
          <text fill="#acedff" fontFamily="monospace" fontSize="10" x="50.5%" y="85%">2.0 m (REF)</text>
          <line stroke="#acedff" strokeWidth="1.5" x1="75%" x2="75%" y1="78%" y2="88%"></line>
          <text fill="#acedff" fontFamily="monospace" fontSize="10" x="75.5%" y="85%">3.0 m</text>
        </svg>
      )}

      {/* 5. Top Telemetry Badges */}
      <div className="relative z-10 flex flex-wrap items-start justify-between gap-sm pointer-events-auto">
        <div className="flex flex-col gap-xs">
          <div className="flex items-center gap-xs">
            <div className="flex items-center gap-xs px-sm py-1 rounded-lg bg-black/70 backdrop-blur-md text-surface-container-lowest border border-white/10 shadow-sm">
              <span className={`w-2.5 h-2.5 rounded-full ${
                isRecording
                  ? 'bg-error animate-ping'
                  : camera.isWebcamActive
                  ? 'bg-emerald-400 animate-pulse'
                  : camera.sourceMode === 'sample'
                  ? 'bg-tertiary-fixed animate-pulse'
                  : camera.sourceMode === 'upload' && camera.uploadedFile
                  ? 'bg-primary-fixed animate-pulse'
                  : 'bg-outline-variant'
              }`}></span>
              <span className="font-data-mono text-[12px] font-bold tracking-wider uppercase text-surface-bright">
                {isRecording
                  ? `REC SESSION: 00:0${timerSeconds} / 00:08`
                  : camera.isWebcamActive
                  ? 'LIVE WEBCAM STREAM · ACTIVE'
                  : camera.sourceMode === 'sample'
                  ? 'SAMPLE WALK VIDEO · PLAYING'
                  : camera.sourceMode === 'upload' && camera.uploadedFile
                  ? `UPLOAD PREVIEW · ${camera.uploadedFile.name.toUpperCase()}`
                  : 'STANDBY · AWAITING CAPTURE'}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-white/10 font-data-mono text-[9px] text-surface-dim">
                {videoDim.w}x{videoDim.h}
              </span>
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

        {/* Dynamic Kinematic Badges */}
        <div className="grid grid-cols-3 gap-xs text-right">
          <div className="bg-black/70 backdrop-blur-md px-sm py-1 rounded-xl flex flex-col border border-white/10">
            <span className="font-label-sm text-[10px] text-tertiary-fixed-dim uppercase font-semibold">Stride</span>
            <span className="font-data-metric text-[18px] font-bold text-surface-container-lowest tracking-tight">
              {kinematics.strideLength} <span className="text-xs text-surface-dim font-normal">m</span>
            </span>
          </div>
          <div className="bg-black/70 backdrop-blur-md px-sm py-1 rounded-xl flex flex-col border border-white/10">
            <span className="font-label-sm text-[10px] text-tertiary-fixed-dim uppercase font-semibold">Cadence</span>
            <span className="font-data-metric text-[18px] font-bold text-surface-container-lowest tracking-tight">
              {kinematics.cadence} <span className="text-xs text-surface-dim font-normal">spm</span>
            </span>
          </div>
          <div className="bg-black/70 backdrop-blur-md px-sm py-1 rounded-xl flex flex-col border border-white/10">
            <span className="font-label-sm text-[10px] text-error-container uppercase font-semibold">Velocity</span>
            <span className="font-data-metric text-[18px] font-bold text-error-container tracking-tight">
              {kinematics.velocity} <span className="text-xs text-surface-dim font-normal">m/s</span>
            </span>
          </div>
        </div>
      </div>

      {/* 6. Precision Calibration Guides & Dynamic Pose Status */}
      {(camera.isWebcamActive || camera.sourceMode === 'sample' || camera.sourceMode === 'upload') && camera.showOverlay && (
        <div className="relative z-10 flex-1 flex flex-col justify-between my-xs overflow-hidden pointer-events-none">
          <div className="absolute inset-4 rounded-xl border border-white/5 pointer-events-none">
            <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-tertiary-fixed-dim"></div>
            <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-tertiary-fixed-dim"></div>
            <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-tertiary-fixed-dim"></div>
            <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-tertiary-fixed-dim"></div>
          </div>

          <div className="flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-data-mono">
              <span className={`w-2 h-2 rounded-full ${
                poseTracker?.trackingStatus === 'tracking' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}></span>
              <span className="text-surface-bright font-bold">
                {poseTracker?.trackingStatus === 'tracking' ? 'MEDIAPIPE 33-POINT POSE ACTIVE' : 'CALIBRATING POSE SKELETON...'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 7. Bottom Bar & Stream Controls */}
      <div className="relative z-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-sm bg-black/80 backdrop-blur-md p-sm rounded-xl border border-white/10 pointer-events-auto">
        <div className="flex items-center gap-sm">
          <div className="flex items-center gap-xs px-xs py-1 rounded bg-error/20 text-error-container">
            <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-error animate-ping' : 'bg-error'}`}></span>
            <span className="font-data-mono font-bold text-xs">
              {isRecording ? `00:0${timerSeconds} / 00:08` : '00:08 Test Ready'}
            </span>
          </div>
          <span className="font-body-sm text-[11px] text-surface-dim hidden md:inline">
            Active Limb: Right Sagittal · 1.0m Runway
          </span>
        </div>

        {/* Progress Bar */}
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

        {/* Opacity & Action Button */}
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

          <span className="text-[10px] text-surface-dim hidden lg:inline">Feed Clarity:</span>
          <input
            type="range"
            min="30"
            max="100"
            value={camera.hudOpacity}
            onChange={(e) => camera.setHudOpacity(Number(e.target.value))}
            className="w-16 h-1.5 accent-primary cursor-pointer hidden lg:inline"
            title="Adjust camera visibility"
          />

          <button
            onClick={camera.isWebcamActive ? camera.stopCamera : () => camera.startCamera()}
            className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
              camera.isWebcamActive
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-primary hover:bg-primary-container text-on-primary'
            }`}
            type="button"
          >
            <span className="material-symbols-outlined text-[15px]">
              {camera.isWebcamActive ? 'videocam' : 'videocam_off'}
            </span>
            {camera.isWebcamActive ? 'Cam Active' : 'Start Cam'}
          </button>

          {onEnterFullHud && (
            <button
              onClick={onEnterFullHud}
              className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-surface-bright text-xs font-semibold transition"
              type="button"
            >
              Full HUD →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
