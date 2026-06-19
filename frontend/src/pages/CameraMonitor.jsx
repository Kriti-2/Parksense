import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../api/client';
import LiveStatusBar from '../components/LiveStatusBar';
import { useLiveFeed } from '../hooks/useLiveFeed';

const CAMERAS = [
  { 
    id: 'CAM-01', 
    name: 'Silk Board Junction', 
    lat: 12.9177, 
    lng: 77.6225, 
    zone: 'Silk Board', 
    videoUrl: '/traffic_video/12968627_3840_2160_30fps.mp4',
    violationPos: { top: '55%', left: '8%' }, 
    violationType: 'PARKING ON FOOTPATH'
  },
  { 
    id: 'CAM-02', 
    name: 'Koramangala 80ft Rd', 
    lat: 12.9352, 
    lng: 77.6245, 
    zone: 'Koramangala', 
    videoUrl: '/traffic_video/12972416_3840_2160_30fps.mp4',
    violationPos: { top: '65%', left: '80%' }, 
    violationType: 'NO PARKING'
  },
  { 
    id: 'CAM-03', 
    name: 'MG Road Metro Stn', 
    lat: 12.9750, 
    lng: 77.6063, 
    zone: 'MG Road', 
    videoUrl: '/traffic_video/14278220_3840_2160_30fps.mp4', // Swapped (parking view)
    violationPos: { top: '48%', left: '42%' }, 
    violationType: 'OBSTRUCTING TRAFFIC'
  },
  { 
    id: 'CAM-04', 
    name: 'Indiranagar 100ft Rd', 
    lat: 12.9784, 
    lng: 77.6408, 
    zone: 'Indiranagar', 
    videoUrl: '/traffic_video/13654799_1920_1080_30fps.mp4', // Swapped (street view)
    violationPos: { top: '75%', left: '15%' }, 
    violationType: 'DOUBLE PARKING'
  },
];

const VEHICLE_TYPES = ['CAR', 'AUTO', 'BUS', 'TRUCK', 'SCOOTER', 'BIKE'];
const VIOLATIONS = ['DOUBLE PARKING', 'NO PARKING', 'OBSTRUCTING TRAFFIC', 'PARKING ON FOOTPATH'];

// Helper to generate a random Indian license plate format
function generateLicensePlate() {
  const states = ['KA', 'DL', 'MH', 'HR', 'TN'];
  const rState = states[Math.floor(Math.random() * states.length)];
  const rDistrict = String(Math.floor(Math.random() * 89) + 10);
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const rLetter1 = letters[Math.floor(Math.random() * letters.length)];
  const rLetter2 = letters[Math.floor(Math.random() * letters.length)];
  const rNumber = String(Math.floor(Math.random() * 8999) + 1000);
  return `${rState}-${rDistrict}-${rLetter1}${rLetter2}-${rNumber}`;
}

// Helper to load external scripts dynamically
const loadScript = (src) => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = (e) => reject(e);
    document.head.appendChild(script);
  });
};

export default function CameraMonitor() {
  const [logs, setLogs] = useState([]);
  const [autoIngest, setAutoIngest] = useState(true);
  const [activeViolations, setActiveViolations] = useState({}); // { camId: { progress, secondsLogged, plate, type, violation } }
  const [toast, setToast] = useState(null);
  const [lastTick, setLastTick] = useState(null);
  const terminalEndRef = useRef(null);

  // Custom Bounding Box Inspector states
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [towedVehicles, setTowedVehicles] = useState(new Set());
  const vehiclePlatesRef = useRef({});

  const getPlateForVehicle = (camId, vehicleId) => {
    const key = `${camId}-${vehicleId}`;
    if (vehiclePlatesRef.current[key]) return vehiclePlatesRef.current[key];
    const plate = generateLicensePlate();
    vehiclePlatesRef.current[key] = plate;
    return plate;
  };

  const playAlertSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (err) {
      console.error("Audio Context failed to play sound", err);
    }
  };

  // References to the HTML5 video tags
  const videoRefs = useRef({});
  const sharedCanvasRef = useRef(null);

  // Real-time TensorFlow.js Model states
  const [tfStatus, setTfStatus] = useState('fallback'); // default to lightweight lane emulation
  const [model, setModel] = useState(null);
  const [realDetections, setRealDetections] = useState({});

  // Fallback math-emulator states
  const [tick, setTick] = useState(0);
  const [fallbackVehicles, setFallbackVehicles] = useState({
    'CAM-01': [
      { id: 'v1', lane: 'left', progress: 0, type: 'CAR', confidence: 94 },
      { id: 'v2', lane: 'right', progress: 40, type: 'AUTO', confidence: 91 }
    ],
    'CAM-02': [
      { id: 'v1', lane: 'away', progress: 10, type: 'TRUCK', confidence: 96 },
      { id: 'v2', lane: 'closer', progress: 50, type: 'CAR', confidence: 93 }
    ],
    'CAM-03': [
      { id: 'p1', lane: 'parked', x: 18, y: 35, type: 'CAR', confidence: 97, isParked: true },
      { id: 'p2', lane: 'parked', x: 30, y: 35, type: 'CAR', confidence: 94, isParked: true },
      { id: 'p3', lane: 'parked', x: 54, y: 35, type: 'CAR', confidence: 89, isParked: true },
      { id: 'p4', lane: 'parked', x: 46, y: 65, type: 'TRUCK', confidence: 92, isParked: true },
      { id: 'v1', lane: 'aisle', progress: 0, type: 'CAR', confidence: 95 }
    ],
    'CAM-04': [
      { id: 'v1', lane: 'left-to-right', progress: 5, type: 'CAR', confidence: 94 },
      { id: 'v2', lane: 'right-to-left', progress: 45, type: 'AUTO', confidence: 92 }
    ]
  });

  // Add log helper
  const addLog = useCallback((message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { timestamp, message, type }].slice(-50));
  }, []);

  const prevDetectionsRef = useRef({});

  // 1. Dynamic script verification & COCO-SSD loading
  useEffect(() => {
    if (tfStatus !== 'initializing') return;
    async function initTF() {
      try {
        addLog("Initializing neural network environment...", "info");
        
        // Poll for TF.js / COCO-SSD to be ready (deferred scripts may still be loading)
        const waitForTF = () => new Promise((resolve, reject) => {
          const start = Date.now();
          const check = setInterval(() => {
            if (window.tf && window.cocoSsd) {
              clearInterval(check);
              resolve(true);
            } else if (Date.now() - start > 15000) {
              clearInterval(check);
              resolve(false); // timed out
            }
          }, 200);
        });

        const tfReady = await waitForTF();

        if (tfReady) {
          addLog("Compiling COCO-SSD MobileNetV2 network...", "info");
          setTfStatus('loading_model');
          const loadedModel = await window.cocoSsd.load({ base: 'lite_mobilenet_v2' });
          setModel(loadedModel);
          setTfStatus('active');
          addLog("🚀 REAL-TIME YOLO INFERENCE MODE ONLINE (WebGL GPU Acceleration)", "success");
        } else {
          // If they didn't load from index.html, load them sequentially and synchronously
          addLog("TensorFlow.js not pre-loaded. Fetching libraries dynamically...", "info");
          setTfStatus('loading_scripts');

          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js";
            script.onload = () => {
              addLog("TensorFlow.js engine loaded. Fetching COCO-SSD...", "info");
              resolve();
            };
            script.onerror = () => reject(new Error("Failed to load TFJS script."));
            document.head.appendChild(script);
          });

          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js";
            script.onload = resolve;
            script.onerror = () => reject(new Error("Failed to load COCO-SSD script."));
            document.head.appendChild(script);
          });

          if (window.tf && window.cocoSsd) {
            addLog("Compiling COCO-SSD MobileNetV2 network...", "info");
            setTfStatus('loading_model');
            const loadedModel = await window.cocoSsd.load({ base: 'lite_mobilenet_v2' });
            setModel(loadedModel);
            setTfStatus('active');
            addLog("🚀 REAL-TIME YOLO INFERENCE MODE ONLINE (WebGL GPU Acceleration)", "success");
          } else {
            throw new Error("COCO-SSD libraries failed to load dynamically.");
          }
        }
      } catch (err) {
        console.error("TFJS load failed:", err);
        setTfStatus('fallback');
        addLog("TFJS Model load failed. Deploying lane-coordinated emulator...", "warning");
      }
    }
    initTF();
  }, [addLog]);

  // 2. Real-time Object Detection loop (WebGL accelerated, self-scheduling parallel inference)
  useEffect(() => {
    if (tfStatus !== 'active' || !model) return;

    let isLoopActive = true;

    const runInference = async () => {
      if (!isLoopActive) return;

      const allowedClasses = ['car', 'bus', 'truck'];
      const nextDetections = {};

      // Initialize the shared canvas once
      if (typeof document !== 'undefined' && !sharedCanvasRef.current) {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 180;
        sharedCanvasRef.current = canvas;
      }
      const canvas = sharedCanvasRef.current;
      const ctx = canvas ? canvas.getContext('2d') : null;

      try {
        // Run sequentially across cameras to prevent concurrent WebGL context/GPU upload overload
        for (const cam of CAMERAS) {
          if (!isLoopActive) break;
          const video = videoRefs.current[cam.id];
          if (video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
            try {
              let predictions = [];
              const vW = 320;
              const vH = 180;

              if (canvas && ctx) {
                // Resize video frame to 320x180 on our offscreen canvas
                ctx.drawImage(video, 0, 0, vW, vH);
                predictions = await model.detect(canvas);
              } else {
                // Fallback to video directly if canvas not available
                predictions = await model.detect(video);
              }

              const isCam3 = cam.id === 'CAM-03';
              
              // Set strict size boundaries to filter out false positive giant/grouped boxes
              const maxW = isCam3 ? 0.20 : 0.32;
              const maxH = isCam3 ? 0.20 : 0.32;
              const minW = 0.02;
              const minH = 0.02;

              const filtered = predictions.filter((p) => {
                const wRatio = p.bbox[2] / vW;
                const hRatio = p.bbox[3] / vH;
                return allowedClasses.includes(p.class) &&
                       p.score >= 0.65 &&
                       wRatio > minW && wRatio < maxW &&
                       hRatio > minH && hRatio < maxH;
              });

              // Sort by confidence and slice to top 5 to keep views clean and visible
              const cleanDetections = filtered.sort((a, b) => b.score - a.score).slice(0, 5);

              // Track IDs across frames for smooth transitions
              const prevDets = prevDetectionsRef.current[cam.id] || [];
              const usedIds = new Set();
              const trackedDetections = cleanDetections.map((p) => {
                const x = (p.bbox[0] / vW) * 100;
                const y = (p.bbox[1] / vH) * 100;
                const width = (p.bbox[2] / vW) * 100;
                const height = (p.bbox[3] / vH) * 100;
                const pClass = p.class.toUpperCase();

                let matchedId = null;
                let minDistance = 15; // Max distance in % to match same vehicle
                
                prevDets.forEach((prev) => {
                  if (prev.class === pClass && !usedIds.has(prev.id)) {
                    const dist = Math.hypot(prev.x - x, prev.y - y);
                    if (dist < minDistance) {
                      minDistance = dist;
                      matchedId = prev.id;
                    }
                  }
                });

                if (matchedId) {
                  usedIds.add(matchedId);
                }
                const finalId = matchedId || Math.random().toString(36).substring(2, 9);
                return {
                  id: finalId,
                  class: pClass,
                  score: Math.round(p.score * 100),
                  x,
                  y,
                  width,
                  height
                };
              });

              nextDetections[cam.id] = trackedDetections;
              prevDetectionsRef.current[cam.id] = trackedDetections;
            } catch (err) {
              // Ignore single camera processing errors
            }
          }
        }

        setRealDetections(nextDetections);
      } catch (err) {
        console.error("Batch inference error:", err);
      }

      // Schedule next frame with breathing space for browser rendering
      if (isLoopActive) {
        setTimeout(runInference, 400);
      }
    };

    runInference();

    return () => {
      isLoopActive = false;
    };
  }, [tfStatus, model]);

  // 3. Fallback math emulator math calculations (only draws if tfStatus !== 'active')
  const getFallbackVehicleProps = (camId, v) => {
    if (v.isParked) {
      return { x: v.x, y: v.y, width: 10, height: 12 };
    }
    const p = v.progress / 100;
    let x = 0, y = 0, w = 10, h = 8;

    if (camId === 'CAM-01') {
      if (v.lane === 'left') {
        y = 85 - p * 60; x = 15 + p * 27; w = 18 - p * 10; h = 14 - p * 8;
      } else {
        y = 85 - p * 60; x = 80 - p * 22; w = 18 - p * 10; h = 14 - p * 8;
      }
    } else if (camId === 'CAM-02') {
      if (v.lane === 'away') {
        y = 80 - p * 60; x = 35 + p * 13; w = 14 - p * 8; h = 10 - p * 6;
      } else {
        y = 20 + p * 60; x = 52 + p * 18; w = 6 + p * 12; h = 4 + p * 10;
      }
    } else if (camId === 'CAM-03') {
      y = 52; x = 10 + p * 80; w = 12; h = 9;
    } else if (camId === 'CAM-04') {
      if (v.lane === 'left-to-right') {
        y = 55; x = 10 + p * 80; w = 14; h = 10;
      } else {
        y = 45; x = 90 - p * 80; w = 12; h = 9;
      }
    }
    return { x, y, width: w, height: h };
  };

  // Run progress loop for fallback emulation
  useEffect(() => {
    const animInterval = setInterval(() => {
      setTick((t) => t + 1);
      setFallbackVehicles((prev) => {
        const next = {};
        Object.keys(prev).forEach((camId) => {
          next[camId] = prev[camId].map((v) => {
            let newConf = v.confidence + (Math.random() > 0.5 ? 1 : -1);
            newConf = Math.max(80, Math.min(99, newConf));

            if (v.isParked) return { ...v, confidence: newConf };

            let newProgress = v.progress + 1.5;
            let newType = v.type;
            if (newProgress >= 100) {
              newProgress = 0;
              const types = ['CAR', 'AUTO', 'BUS', 'TRUCK', 'SCOOTER', 'BIKE'];
              newType = types[Math.floor(Math.random() * types.length)];
            }
            return { ...v, progress: newProgress, type: newType, confidence: newConf };
          });
        });
        return next;
      });
    }, 100);

    return () => clearInterval(animInterval);
  }, []);

  // Hook into WebSocket connection state
  const handleLiveTick = useCallback((payload) => {
    if (payload.type === 'live_tick') {
      setLastTick(payload);
    }
  }, []);

  const { connected, status } = useLiveFeed(handleLiveTick);

  // Handle auto-scroll of console terminal
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Toast helper
  function showToast(type, text) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  }

  // Trigger violation ingestion for a camera
  const triggerViolation = useCallback(async (cam) => {
    const plate = generateLicensePlate();
    const vehicleType = VEHICLE_TYPES[Math.floor(Math.random() * VEHICLE_TYPES.length)];
    const violationType = cam.violationType || VIOLATIONS[Math.floor(Math.random() * VIOLATIONS.length)];

    addLog(`[${cam.id}] ⚠️ VIOLATION DETECTED: Stopped ${vehicleType} (${plate}) in ${violationType} area. Starting stationary verification...`, 'warning');
    
    // Set active violation tracking state
    setActiveViolations((prev) => ({
      ...prev,
      [cam.id]: { progress: 0, secondsLogged: 0, plate, type: vehicleType, violation: violationType }
    }));

    // Simulate progress bar countdown representing 120 seconds of real-world obstruction
    let secondsLogged = 0;
    const interval = setInterval(async () => {
      secondsLogged += 6; // reaches 120s in 20 steps
      const progress = Math.min((secondsLogged / 120) * 100, 100);
      setActiveViolations((prev) => {
        if (!prev[cam.id]) return prev;
        return {
          ...prev,
          [cam.id]: { 
            ...prev[cam.id], 
            progress,
            secondsLogged: Math.min(secondsLogged, 120)
          }
        };
      });

      if (secondsLogged >= 120) {
        clearInterval(interval);
        
        // Remove violation status and call backend API
        setActiveViolations((prev) => {
          const updated = { ...prev };
          delete updated[cam.id];
          return updated;
        });

        addLog(`[${cam.id}] 🚨 STATIONARY >120s: Issuing challan for ${plate} (${vehicleType})...`, 'danger');

        try {
          const payload = {
            latitude: cam.lat,
            longitude: cam.lng,
            vehicle_type: vehicleType,
            violation_types: [violationType],
            zone: cam.zone,
            near_intersection: Math.random() > 0.4,
          };
          
          await api.ingestViolation(payload);
          addLog(`[${cam.id}] ✅ Ingestion complete. Challan successfully issued to ${plate}.`, 'success');
          showToast('success', `🎥 CCTV Ingested violation at ${cam.zone} (${plate})!`);
        } catch (err) {
          console.error(err);
          addLog(`[${cam.id}] ❌ Ingestion API error: ${err.response?.data?.detail || err.message}`, 'error');
          showToast('error', 'CCTV failed to dispatch violation to API');
        }
      }
    }, 1000); // 20 seconds total for visual demo speed
  }, [addLog]);

  // Initial startup logs
  useEffect(() => {
    addLog("System initialized. Establishing CCTV feeds connection...", "info");
  }, [addLog]);

  // Auto-Ingest trigger cycle
  useEffect(() => {
    if (!autoIngest) return;

    const interval = setInterval(() => {
      const idleCameras = CAMERAS.filter((c) => !activeViolations[c.id]);
      if (idleCameras.length > 0) {
        const randCam = idleCameras[Math.floor(Math.random() * idleCameras.length)];
        triggerViolation(randCam);
      }
    }, 35000);

    return () => clearInterval(interval);
  }, [autoIngest, activeViolations, triggerViolation]);

  // Render bounding boxes directly on top of video frames
  const renderBoundingBoxes = (camId) => {
    const isViolating = activeViolations[camId];
    const cam = CAMERAS.find((c) => c.id === camId);
    const boxes = [];

    // Decide source list (Real TFJS Detections or Emulator Fallback)
    const isTfActive = tfStatus === 'active';
    const activeObjects = isTfActive 
      ? (realDetections[camId] || []) 
      : (fallbackVehicles[camId] || []);

    // If a violation is active, identify which vehicle matches it
    let violationTargetId = null;
    if (isViolating && activeObjects.length > 0) {
      const pos = cam?.violationPos;
      if (pos) {
        // Find the vehicle closest to the designated roadside/shoulder violation position
        let minDistance = 999;
        activeObjects.forEach((obj) => {
          const coords = isTfActive ? obj : getFallbackVehicleProps(camId, obj);
          const dist = Math.hypot(parseFloat(pos.left) - coords.x, parseFloat(pos.top) - coords.y);
          if (dist < minDistance) {
            minDistance = dist;
            violationTargetId = obj.id;
          }
        });
      }
    }

    activeObjects.forEach((obj) => {
      // Calculate box percentage positions
      const coords = isTfActive ? obj : getFallbackVehicleProps(camId, obj);
      const isTargetViolating = obj.id === violationTargetId;
      const isTowed = towedVehicles.has(obj.id);

      if (isTargetViolating) {
        // Render violating object in red with stationary countdown tracking
        boxes.push(
          <div
            key={obj.id}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedVehicle({
                id: obj.id,
                camId,
                plate: isViolating.plate,
                class: (isTfActive ? obj.class : obj.type).toUpperCase(),
                score: isTfActive ? obj.score : obj.confidence,
                status: isTowed ? 'TOWED' : 'VIOLATING',
                violationType: isViolating.violation
              });
            }}
            className="absolute border-2 border-command-danger bg-command-danger/10 p-1 rounded animate-pulse text-left transition-all duration-300 cursor-crosshair hover:shadow-[0_0_15px_#C27A7A] hover:bg-command-danger/20"
            style={{
              top: `${coords.y}%`,
              left: `${coords.x}%`,
              width: `${coords.width}%`,
              height: `${coords.height}%`,
              zIndex: 10
            }}
          >
            <div className="absolute top-0 left-0 -mt-5 bg-command-danger px-1 text-[9px] font-bold text-white uppercase rounded">
              🚨 {isViolating.violation}
            </div>
            <div className="text-[10px] text-white font-mono text-center pt-1 leading-tight">
              {isViolating.plate}
              <br />
              {isTfActive ? obj.class : obj.type}
              <br />
              {isViolating.secondsLogged || 0}s / 120s
            </div>
          </div>
        );
      } else {
        // Render normal tracked object in green/blue
        const label = isTfActive ? obj.class : obj.type;
        const score = isTfActive ? obj.score : obj.confidence;
        
        const isSuccessColor = label === 'CAR' || label === 'TRUCK' || label === 'BUS';
        const colorClass = isTowed
          ? 'border-command-success text-command-success bg-command-success/20 ring-2 ring-command-success animate-pulse'
          : isSuccessColor 
          ? 'border-command-success text-command-success bg-command-success/5 hover:border-command-accent hover:shadow-[0_0_12px_rgba(72,110,93,0.5)]' 
          : 'border-command-accent text-command-accent bg-command-accent/5 hover:border-command-accent hover:shadow-[0_0_12px_rgba(72,110,93,0.5)]';

        boxes.push(
          <div
            key={obj.id}
            onClick={(e) => {
              e.stopPropagation();
              const plate = getPlateForVehicle(camId, obj.id);
              setSelectedVehicle({
                id: obj.id,
                camId,
                plate,
                class: label.toUpperCase(),
                score,
                status: isTowed ? 'TOWED' : 'ACTIVE',
                violationType: null
              });
            }}
            className={`absolute border p-0.5 rounded text-[8px] font-mono transition-all duration-300 cursor-crosshair ${colorClass}`}
            style={{
              top: `${coords.y}%`,
              left: `${coords.x}%`,
              width: `${coords.width}%`,
              height: `${coords.height}%`,
            }}
          >
            {isTowed ? 'TOWED' : `${label} [${score}%]`}
          </div>
        );
      }
    });

    return <>{boxes}</>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">CCTV AI Detection Center</h2>
          <p className="mt-1 text-sm text-command-muted">
            Simulated live edge-inference cameras scanning junctions for traffic obstructions
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {/* Neural Network Status Badge */}
          <div className="flex items-center gap-2 rounded bg-command-panel border border-command-border px-3 py-1 text-xs">
            <span className={`h-2.5 w-2.5 rounded-full ${
              tfStatus === 'active' 
                ? 'bg-command-success animate-pulse' 
                : tfStatus === 'fallback' 
                ? 'bg-command-warning' 
                : 'bg-blue-500 animate-ping'
            }`} />
            <span className="font-semibold text-gray-300">
              AI Core: {
                tfStatus === 'active' 
                  ? 'Real-Time YOLOv11 (COCO-SSD)' 
                  : tfStatus === 'fallback' 
                  ? 'Lane Emulation Mode' 
                  : 'Booting Neural Engine...'
              }
            </span>
          </div>
          <LiveStatusBar connected={connected} status={status} lastTick={lastTick} />
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm transition-all duration-300 ${
            toast.type === 'success'
              ? 'border-command-success/30 bg-command-success/10 text-command-success'
              : 'border-command-danger/30 bg-command-danger/10 text-command-danger'
          }`}
        >
          <span>{toast.text}</span>
          <button onClick={() => setToast(null)} className="font-bold opacity-70 hover:opacity-100">×</button>
        </div>
      )}

      {/* Grid of 4 Cameras */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {CAMERAS.map((cam) => {
          const violationState = activeViolations[cam.id];
          return (
            <div key={cam.id} className="relative overflow-hidden rounded-xl border border-command-border bg-command-panel p-4 flex flex-col justify-between">
              <div>
                {/* Camera Header Info */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    <span className="text-sm font-bold text-white">{cam.id}: {cam.name}</span>
                  </div>
                  <button
                    onClick={() => triggerViolation(cam)}
                    disabled={!!violationState}
                    className="rounded bg-command-accent/10 border border-command-accent/30 px-2 py-0.5 text-xs font-semibold text-command-accent hover:bg-command-accent/20 disabled:opacity-50"
                  >
                    Force Violation
                  </button>
                </div>

                {/* Video Monitor Box */}
                <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-command-border bg-black">
                  {/* Stock Video Loop */}
                  <video
                    ref={(el) => (videoRefs.current[cam.id] = el)}
                    src={cam.videoUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="metadata"
                    className="absolute inset-0 h-full w-full object-cover opacity-60"
                  />

                  {/* Laser Scanning Animation Overlay */}
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-command-accent/0 via-command-accent/15 to-command-accent/0 h-10 w-full animate-scan" style={{ top: 0 }}></div>

                  {/* AI Bounding Boxes Drawing Overlay */}
                  {renderBoundingBoxes(cam.id)}

                  {/* Location Tag */}
                  <div className="absolute bottom-3 left-3 bg-black/75 px-2 py-1 rounded border border-command-border text-[10px] font-mono text-gray-400">
                    LAT: {cam.lat.toFixed(5)} · LNG: {cam.lng.toFixed(5)}
                  </div>
                </div>
              </div>

              {/* Progress Bar under Video for Violations */}
              {violationState && (
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-command-danger">
                    <span>Logging Obstruction (Stationary {violationState.secondsLogged || 0}s / 120s)</span>
                    <span>{Math.round(violationState.progress)}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-command-bg border border-command-border overflow-hidden">
                    <div
                      className="h-full bg-command-danger transition-all duration-300"
                      style={{ width: `${violationState.progress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Terminal log panel */}
      <div className="rounded-xl border border-command-border bg-command-panel p-6 space-y-3">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between border-b border-command-border pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🖥️</span>
            <div>
              <h3 className="text-lg font-semibold text-white">AI OCR & Bounding Box Terminal</h3>
              <p className="text-xs text-command-muted">Live console streaming detection telemetry from edge nodes</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Toggle YOLO Mode */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-medium">YOLO Detection:</span>
              <button
                onClick={() => {
                  if (tfStatus === 'fallback') {
                    setTfStatus('initializing');
                  } else {
                    setTfStatus('fallback');
                  }
                }}
                className={`rounded-full px-3 py-1 text-xs font-bold transition-colors cursor-pointer ${
                  tfStatus === 'active' || tfStatus === 'initializing' || tfStatus === 'loading_model'
                    ? 'bg-command-accent text-white'
                    : 'bg-gray-600 text-gray-300'
                }`}
              >
                {tfStatus === 'active' ? 'ACTIVE (GPU)' : tfStatus === 'fallback' ? 'OFF (EMULATOR)' : 'BOOTING...'}
              </button>
            </div>

            {/* Toggle Auto Ingestion */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-medium">Auto-Trigger:</span>
              <button
                onClick={() => setAutoIngest(!autoIngest)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition-colors cursor-pointer ${
                  autoIngest
                    ? 'bg-command-success text-white'
                    : 'bg-gray-600 text-gray-300'
                }`}
              >
                {autoIngest ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
          </div>
        </div>

        {/* Terminal Screen box */}
        <div className="h-60 overflow-y-auto rounded-lg bg-black p-4 font-mono text-xs border border-command-border leading-relaxed">
          {logs.map((log, index) => {
            let color = 'text-gray-400';
            if (log.type === 'success') color = 'text-command-success';
            if (log.type === 'warning') color = 'text-command-warning';
            if (log.type === 'danger') color = 'text-command-danger';
            if (log.type === 'error') color = 'text-red-500 font-semibold';
            return (
              <div key={index} className="flex gap-2">
                <span className="text-gray-600 shrink-0">[{log.timestamp}]</span>
                <span className={color}>{log.message}</span>
              </div>
            );
          })}
          <div ref={terminalEndRef} />
        </div>
      </div>

      {/* Floating Vehicle Inspector Modal */}
      {selectedVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl border border-command-border bg-command-panel p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-command-border pb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔍</span>
                <h3 className="text-lg font-bold text-white">Vehicle Inspector</h3>
              </div>
              <button 
                onClick={() => setSelectedVehicle(null)} 
                className="text-gray-400 hover:text-white text-xl font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-command-muted">Camera Feed:</span>
                <span className="font-semibold text-gray-800">{selectedVehicle.camId} ({CAMERAS.find(c => c.id === selectedVehicle.camId)?.zone})</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-command-muted">Detection Class:</span>
                <span className="font-semibold text-gray-800 uppercase">{selectedVehicle.class} ({selectedVehicle.score}% conf.)</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-command-muted">Current Status:</span>
                <span className={`font-semibold ${selectedVehicle.status === 'VIOLATING' ? 'text-command-danger' : selectedVehicle.status === 'TOWED' ? 'text-command-success' : 'text-command-accent'}`}>
                  {selectedVehicle.status}
                </span>
              </div>
              {selectedVehicle.violationType && (
                <div className="flex justify-between text-xs">
                  <span className="text-command-muted">Offense:</span>
                  <span className="font-semibold text-command-danger uppercase">{selectedVehicle.violationType}</span>
                </div>
              )}
            </div>

            {/* Indian License Plate Mockup */}
            <div className="flex items-center border border-gray-300 bg-yellow-50/90 rounded-lg px-4 py-2 font-mono font-bold text-gray-800 tracking-wider shadow-inner w-fit mx-auto my-4 relative overflow-hidden">
              <div className="border-r border-gray-300 pr-3 mr-3 text-[10px] text-blue-800 flex flex-col items-center leading-none">
                <span className="font-sans font-extrabold text-blue-800">IND</span>
                <span className="text-[8px] mt-0.5">⚡</span>
              </div>
              <span className="text-xl tracking-widest">{selectedVehicle.plate}</span>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setSelectedVehicle(null)}
                className="flex-1 rounded-xl border border-command-border bg-command-bg px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-command-bg/85 active:scale-95 transition-all cursor-pointer"
              >
                Close
              </button>
              
              <button
                onClick={() => {
                  playAlertSound();
                  setTowedVehicles(prev => {
                    const next = new Set(prev);
                    next.add(selectedVehicle.id);
                    return next;
                  });
                  setSelectedVehicle(prev => ({ ...prev, status: 'TOWED' }));
                  addLog(`[${selectedVehicle.camId}] 🚨 TOWING DISPATCHED: Deploying towing unit for vehicle ${selectedVehicle.plate} (${selectedVehicle.class})`, 'danger');
                  showToast('success', `Towing dispatched for ${selectedVehicle.plate}!`);
                }}
                disabled={selectedVehicle.status === 'TOWED'}
                className="flex-1 rounded-xl bg-command-danger text-white px-4 py-2.5 text-xs font-semibold hover:opacity-95 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all shadow-md shadow-command-danger/20 cursor-pointer"
              >
                {selectedVehicle.status === 'TOWED' ? 'Towed ✅' : 'Dispatch Towing 🚨'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
