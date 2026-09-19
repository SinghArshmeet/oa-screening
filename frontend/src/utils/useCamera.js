import { useState, useEffect, useRef, useCallback } from 'react';
import {
  pingDevice,
  getEspCamStatus,
  controlEspCam,
  getEspCamStreamUrl,
  getEspCamFrameUrl,
  getEspCamWebSocketUrl,
  cleanEspHost
} from './api';

export function useCamera(isAuthenticated = false) {
  const [stream, setStream] = useState(null);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [availableDevices, setAvailableDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [sourceMode, setSourceMode] = useState('webcam'); // 'webcam' | 'espcam' | 'sample' | 'upload'
  const [sampleVideoUrl, setSampleVideoUrl] = useState(() => `${(import.meta.env.BASE_URL || '/').replace(/\/$/, '')}/sample_gait_walk.mp4`);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [showOverlay, setShowOverlay] = useState(false); // Default to clean feed without overlay
  const [hudOpacity, setHudOpacity] = useState(85);
  const [isSecureContext, setIsSecureContext] = useState(true);

  // ESP32-CAM State
  const [espIp, setEspIpState] = useState(() => {
    try {
      const saved = localStorage.getItem('orthonex_espcam_ip');
      if (!saved || saved === '192.168.1.105' || saved.startsWith('192.168.1.')) {
        localStorage.setItem('orthonex_espcam_ip', '192.168.0.109');
        return '192.168.0.109';
      }
      return saved;
    } catch {
      return '192.168.0.109';
    }
  });
  const [isEspOnline, setIsEspOnline] = useState(false);
  const [isEspConnected, setIsEspConnected] = useState(false);
  const [espStatus, setEspStatus] = useState('idle'); // 'idle' | 'connecting' | 'connected' | 'error'
  const [espLatency, setEspLatency] = useState(null);
  const [espFlash, setEspFlash] = useState(false);
  const [espRes, setEspRes] = useState('QVGA');
  const [espVFlip, setEspVFlip] = useState(false);
  const [espHMirror, setEspHMirror] = useState(false);
  const [espStreamUrl, setEspStreamUrl] = useState(() => getEspCamStreamUrl('192.168.0.109'));
  const [espFrameBlobUrl, setEspFrameBlobUrl] = useState(null);
  const [isWsRelayActive, setIsWsRelayActive] = useState(false);
  const wsRef = useRef(null);
  const lastBlobUrlRef = useRef(null);

  // Connect to Cloud WebSocket Relay (Option B)
  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;
    let active = true;

    const connectWs = () => {
      if (!active) return;
      try {
        const wsUrl = getEspCamWebSocketUrl();
        ws = new WebSocket(wsUrl);
        ws.binaryType = 'blob';
        wsRef.current = ws;

        ws.onopen = () => {
          if (!active) return;
          setIsWsRelayActive(true);
        };

        ws.onmessage = (event) => {
          if (!active) return;
          if (event.data instanceof Blob) {
            const newUrl = URL.createObjectURL(event.data);
            const oldUrl = lastBlobUrlRef.current;
            lastBlobUrlRef.current = newUrl;
            setEspFrameBlobUrl(newUrl);

            // Revoke old blob after brief delay to avoid black frame flickering
            if (oldUrl) {
              setTimeout(() => {
                try { URL.revokeObjectURL(oldUrl); } catch {}
              }, 800);
            }
            setIsEspConnected(true);
            setIsEspOnline(true);
            setEspStatus('connected');
          } else if (typeof event.data === 'string') {
            try {
              const msg = JSON.parse(event.data);
              if (msg.type === 'camera_status') {
                if (msg.online !== undefined) {
                  setIsEspOnline(Boolean(msg.online));
                  if (!msg.online) setEspStatus('idle');
                }
                if (msg.flash !== undefined) setEspFlash(Boolean(msg.flash));
                if (msg.fps) setEspLatency(`${msg.fps} FPS (Cloud)`);
              }
            } catch {}
          }
        };

        ws.onclose = () => {
          if (!active) return;
          setIsWsRelayActive(false);
          reconnectTimeout = setTimeout(connectWs, 3000);
        };

        ws.onerror = () => {
          if (ws) ws.close();
        };
      } catch (err) {
        reconnectTimeout = setTimeout(connectWs, 4000);
      }
    };

    connectWs();

    return () => {
      active = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        try { ws.close(); } catch {}
      }
    };
  }, []);

  // Background heartbeat to detect Cloud Relay & local ESP32-CAM online/offline state
  const checkEspOnline = useCallback(async (ipToCheck) => {
    // 1. Check cloud relay first
    try {
      const statusRes = await fetch(`${API_BASE}/api/esp/ws/status`, { signal: AbortSignal.timeout(2500) });
      if (statusRes.ok) {
        const data = await statusRes.json();
        if (data.camera_online) {
          setIsEspOnline(true);
          setEspLatency(`${data.fps || 12} FPS (Cloud)`);
          return true;
        }
      }
    } catch {}

    // 2. Fallback to direct local ping
    const target = cleanEspHost(ipToCheck || espIp);
    try {
      const res = await pingDevice(target);
      const online = Boolean(res && res.reachable);
      setIsEspOnline(online);
      if (res?.latency) setEspLatency(res.latency);
      return online;
    } catch {
      return false;
    }
  }, [espIp]);

  useEffect(() => {
    let active = true;
    const runPing = async () => {
      try {
        // First check cloud status
        const statusRes = await fetch(`${API_BASE}/api/esp/ws/status`, { signal: AbortSignal.timeout(3000) });
        if (statusRes.ok && active) {
          const data = await statusRes.json();
          if (data.camera_online) {
            setIsEspOnline(true);
            setIsEspConnected(true);
            setEspStatus('connected');
            setEspLatency(`${data.fps || 12} FPS (Cloud)`);
            return;
          }
        }
      } catch {}

      try {
        const res = await pingDevice(espIp);
        if (active) {
          setIsEspOnline(Boolean(res && res.reachable));
          if (res?.latency) setEspLatency(res.latency);
        }
      } catch {
        if (active && !isWsRelayActive) setIsEspOnline(false);
      }
    };
    runPing();
    const interval = setInterval(runPing, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [espIp, isWsRelayActive]);

  const setEspIp = useCallback((ip) => {
    const cleaned = cleanEspHost(ip);
    setEspIpState(cleaned);
    try {
      localStorage.setItem('orthonex_espcam_ip', cleaned);
    } catch {}
    setEspStreamUrl(getEspCamStreamUrl(cleaned));
    checkEspOnline(cleaned);
  }, [checkEspOnline]);

  const streamRef = useRef(null);
  const espCanvasRef = useRef(null);
  const espImgRef = useRef(null);
  const espAnimRef = useRef(null);

  // Clean up object URL when component unmounts or video changes
  useEffect(() => {
    return () => {
      if (uploadedVideoUrl) {
        try {
          URL.revokeObjectURL(uploadedVideoUrl);
        } catch {}
      }
    };
  }, [uploadedVideoUrl]);

  // Check secure context
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isSec = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      setIsSecureContext(Boolean(isSec));
    }
  }, []);

  // Enumerate cameras ONLY when user is authenticated
  const refreshDevices = useCallback(async () => {
    if (!isAuthenticated) return;
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devs.filter((d) => d.kind === 'videoinput');
      setAvailableDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    } catch (e) {
      console.warn('Could not enumerate cameras:', e);
    }
  }, [isAuthenticated, selectedDeviceId]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshDevices();
    }
  }, [isAuthenticated, refreshDevices]);

  // Robust camera starter
  const startCamera = useCallback(async (deviceIdOverride) => {
    // Clear previous
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setStream(null);
    setIsWebcamActive(false);
    setCameraError(null);

    // Check MediaDevices support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const err = !window.isSecureContext
        ? 'Camera access is blocked because you are browsing on an unencrypted network IP. Please open http://localhost:5173/ in your browser.'
        : 'navigator.mediaDevices.getUserMedia is not supported by your browser. Please use Chrome, Edge, or Firefox on http://localhost:5173.';
      setCameraError(err);
      return false;
    }

    const targetDevId = deviceIdOverride || selectedDeviceId;
    const constraintsList = [
      // 1. Device ID + Ideal HD
      targetDevId
        ? { video: { deviceId: { exact: targetDevId }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }
        : null,
      // 2. Ideal HD without Device ID
      { video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false },
      // 3. Fallback standard resolution
      { video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
      // 4. Basic video constraint (never fails due to resolution restrictions)
      { video: true, audio: false }
    ].filter(Boolean);

    let acquiredStream = null;
    let lastError = null;

    for (const c of constraintsList) {
      try {
        acquiredStream = await navigator.mediaDevices.getUserMedia(c);
        if (acquiredStream) break;
      } catch (err) {
        lastError = err;
        console.warn('Camera constraint attempt failed:', c, err.name, err.message);
      }
    }

    if (!acquiredStream) {
      console.error('All camera attempts failed:', lastError);
      if (lastError?.name === 'NotAllowedError' || lastError?.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was blocked. Click the camera/tune icon in your browser address bar (next to the URL), change Camera to "Allow", and click Try Again.');
      } else if (lastError?.name === 'NotFoundError' || lastError?.name === 'DevicesNotFoundError') {
        setCameraError('No webcam detected on this computer. You can connect a USB webcam or click "Sample Walk Clip" to test with reference patient video.');
      } else if (lastError?.name === 'NotReadableError' || lastError?.name === 'TrackStartError') {
        setCameraError('Camera is already open in another application (Windows Camera, Teams, Zoom, Meet, etc.). Close other apps using the camera and click Try Again.');
      } else {
        setCameraError(`Camera error: ${lastError?.message || 'Could not access video feed'}`);
      }
      return false;
    }

    streamRef.current = acquiredStream;
    setStream(acquiredStream);
    setIsWebcamActive(true);
    setSourceMode('webcam');
    refreshDevices();
    return true;
  }, [selectedDeviceId, refreshDevices]);

  const disconnectEspCam = useCallback(() => {
    if (espAnimRef.current) {
      cancelAnimationFrame(espAnimRef.current);
      espAnimRef.current = null;
    }
    if (espImgRef.current) {
      espImgRef.current.src = '';
    }
    setIsEspConnected(false);
    setEspStatus('idle');
  }, []);

  const stopCamera = useCallback(() => {
    disconnectEspCam();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setStream(null);
    setIsWebcamActive(false);
  }, [disconnectEspCam]);

  const connectEspCam = useCallback(async (ipOverride) => {
    stopCamera();
    const targetIp = cleanEspHost(ipOverride || espIp);
    setEspIp(targetIp);
    setEspStatus('connecting');
    setCameraError(null);

    const streamUrl = getEspCamStreamUrl(targetIp);
    setEspStreamUrl(streamUrl);

    // 1. Probe connectivity (cloud relay or local)
    checkEspOnline(targetIp);

    setSourceMode('espcam');
    setIsEspConnected(true);
    setIsEspOnline(true);
    setEspStatus('connected');
    setIsWebcamActive(false);
    return true;
  }, [espIp, setEspIp, stopCamera, checkEspOnline]);

  const toggleEspFlash = useCallback(async () => {
    const next = !espFlash;
    setEspFlash(next);

    // Send command directly over Cloud WebSocket Relay
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({
          type: 'control',
          command: 'flash',
          flash: next ? 1 : 0,
          val: next ? 1 : 0
        }));
      } catch (err) {
        console.warn('Failed to send flash toggle via WebSocket:', err);
      }
    }

    // Also attempt local subnet fallback
    controlEspCam(espIp, 'flash', next ? 1 : 0).catch(() => {});
  }, [espFlash, espIp]);

  const setEspResolution = useCallback(async (resName) => {
    const map = { QVGA: 5, CIF: 6, VGA: 8, SVGA: 9, XGA: 10, SXGA: 11, UXGA: 12 };
    const val = map[resName] ?? 5;
    setEspRes(resName);
    await controlEspCam(espIp, 'framesize', val);
  }, [espIp]);

  const toggleEspVFlip = useCallback(async () => {
    const next = !espVFlip;
    setEspVFlip(next);
    await controlEspCam(espIp, 'vflip', next ? 1 : 0);
  }, [espVFlip, espIp]);

  const toggleEspHMirror = useCallback(async () => {
    const next = !espHMirror;
    setEspHMirror(next);
    await controlEspCam(espIp, 'hmirror', next ? 1 : 0);
  }, [espHMirror, espIp]);

  const refreshEspStatus = useCallback(async () => {
    const pingRes = await pingDevice(espIp);
    const reachable = Boolean(pingRes && pingRes.reachable);
    setIsEspOnline(reachable);
    setEspLatency(pingRes.latency);
    const st = await getEspCamStatus(espIp);
    if (st) {
      if (st.flash !== undefined) setEspFlash(st.flash > 0);
      else if (st.led_intensity !== undefined) setEspFlash(st.led_intensity > 0);
      if (st.vflip !== undefined) setEspVFlip(Boolean(st.vflip));
      if (st.hmirror !== undefined) setEspHMirror(Boolean(st.hmirror));
    }
  }, [espIp]);

  const selectSample = useCallback((videoUrl) => {
    stopCamera();
    if (videoUrl) {
      setSampleVideoUrl(videoUrl);
    }
    setSourceMode('sample');
    setCameraError(null);
  }, [stopCamera]);

  const setUploadedVideo = useCallback((file) => {
    stopCamera();
    if (uploadedVideoUrl) {
      try {
        URL.revokeObjectURL(uploadedVideoUrl);
      } catch {}
    }
    if (file) {
      const url = URL.createObjectURL(file);
      setUploadedFile(file);
      setUploadedVideoUrl(url);
      setSourceMode('upload');
    } else {
      setUploadedFile(null);
      setUploadedVideoUrl(null);
    }
    setCameraError(null);
  }, [stopCamera, uploadedVideoUrl]);

  return {
    stream,
    streamRef,
    isWebcamActive,
    cameraError,
    setCameraError,
    availableDevices,
    selectedDeviceId,
    setSelectedDeviceId,
    sourceMode,
    setSourceMode,
    sampleVideoUrl,
    setSampleVideoUrl,
    uploadedVideoUrl,
    setUploadedVideoUrl,
    uploadedFile,
    setUploadedFile,
    setUploadedVideo,
    showOverlay,
    setShowOverlay,
    hudOpacity,
    setHudOpacity,
    isSecureContext,
    isSampleVideo: sourceMode === 'sample',
    startCamera,
    stopCamera,
    selectSample,
    switchToSampleVideo: selectSample,

    // ESP32-CAM exports
    espIp,
    setEspIp,
    isEspOnline,
    checkEspOnline,
    isEspConnected,
    espStatus,
    espLatency,
    espFlash,
    espRes,
    espVFlip,
    espHMirror,
    espStreamUrl,
    espFrameBlobUrl,
    isWsRelayActive,
    connectEspCam,
    disconnectEspCam,
    toggleEspFlash,
    setEspResolution,
    toggleEspVFlip,
    toggleEspHMirror,
    refreshEspStatus
  };
}
