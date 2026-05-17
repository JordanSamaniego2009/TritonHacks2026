"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import "leaflet/dist/leaflet.css";
import Webcam from "react-webcam";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ─── Supabase ──────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const videoConstraints = { facingMode: { ideal: "environment" } };

// ─── Types ─────────────────────────────────────────────────────────────────────
type Pin = {
  id: number;
  created_at: string;
  image: string | null;
  user_id: string;
  latitude: number;
  longitude: number;
  label?: string;
  note?: string;
  analysis?: string;
};

type AnalysisResult = {
  scene_type: string;
  culture: string;
  historical_context: string;
  description: string;
  weather: string;
  flora_fauna: string[];
  confidence: number;
  location: string;
  imageBase64?: string;
  error?: string;
};

type MapPanelProps = {
  onAnalysisResult?: (result: AnalysisResult, pinId?: number) => void;
  onPinContextSwitch?: (pin: Pin | null) => void;
};

// ─── Colors ────────────────────────────────────────────────────────────────────
const MY_COLOR     = "#60a5fa"; // blue-400 — pops on dark map
const OTHER_COLOR  = "#f87171"; // red-400
const ACTIVE_COLOR = "#facc15"; /f/

// ─── Icon builders ─────────────────────────────────────────────────────────────
function buildSvgIcon(color: string, L: any, active = false) {
  // Active pin gets a glowing ring + larger size
  const size   = active ? 36 : 28;
  const height = active ? 46 : 36;
  const ring   = active
    ? `<circle cx="${size / 2}" cy="${size / 2 - 4}" r="${size / 2 + 5}" fill="none" stroke="${ACTIVE_COLOR}" stroke-width="3" opacity="0.6"/>`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${height}" viewBox="0 0 ${size} ${height}">
    ${ring}
    <path d="M${size / 2} 0C${size * 0.241} 0 0 ${size * 0.241} 0 ${size / 2}c0 ${size * 0.333} ${size / 2} ${height - size / 2} ${size / 2} ${height - size / 2}S${size} ${size / 2 + size * 0.333} ${size} ${size / 2}C${size} ${size * 0.241} ${size * 0.759} 0 ${size / 2} 0z" fill="${color}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.214}" fill="white" fill-opacity="0.9"/>
  </svg>`;
  return L.divIcon({
    className: "",
    html: svg,
    iconSize:   [size, height],
    iconAnchor: [size / 2, height],
    popupAnchor: [0, -height - 4],
  });
}

// ─── Pin Detail Modal ──────────────────────────────────────────────────────────
function PinModal({
  pin, currentUserId, activeContextPinId, onClose, onDelete, onSwitchContext,
}: {
  pin: Pin;
  currentUserId: string;
  activeContextPinId: number | null;
  onClose: () => void;
  onDelete: (id: number) => void;
  onSwitchContext: (pin: Pin | null) => void;
}) {
  const isOwn    = pin.user_id === currentUserId;
  const isActive = activeContextPinId === pin.id;
  const date     = new Date(pin.created_at).toLocaleString();

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-sm mx-4">
        {/* Active glow border */}
        {isActive && (
          <div className="absolute -inset-1 rounded-2xl bg-yellow-400/40 blur-sm pointer-events-none" />
        )}
        <Card className={`shadow-2xl border overflow-hidden relative ${isActive ? "border-yellow-400" : "border-border"}`}>
          {/* Active badge */}
          {isActive && (
            <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 bg-yellow-400 text-yellow-900 text-xs font-semibold px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-900 animate-pulse inline-block" />
              AI Context
            </div>
          )}

          {/* Image */}
          {pin.image ? (
            <div className="w-full aspect-video bg-muted overflow-hidden">
              <img src={pin.image} alt="pin" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-full aspect-video bg-muted flex items-center justify-center text-muted-foreground text-sm">
              No image
            </div>
          )}

          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors text-xs"
          >✕</button>

          <CardContent className="flex flex-col gap-3 pt-4 pb-5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-foreground">
                  {pin.label || (isOwn ? "My Pin" : "Someone's Pin")}
                </span>
                <span className="text-xs text-muted-foreground">{date}</span>
              </div>
              <Badge variant={isOwn ? "default" : "secondary"} className="shrink-0">
                {isOwn ? "You" : "Other user"}
              </Badge>
            </div>

            <div className="flex gap-2 text-xs text-muted-foreground font-mono bg-muted/50 rounded-md px-3 py-2">
              <span>{pin.latitude.toFixed(5)},</span>
              <span>{pin.longitude.toFixed(5)}</span>
            </div>

            {pin.note && <p className="text-sm text-foreground/80">{pin.note}</p>}

            {pin.analysis && (
              <div className="bg-muted/60 rounded-md px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">AI: </span>
                {pin.analysis.slice(0, 160)}{pin.analysis.length > 160 ? "…" : ""}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                className={`flex-1 ${isActive ? "bg-yellow-400 text-yellow-900 hover:bg-yellow-300" : ""}`}
                variant={isActive ? "default" : "default"}
                onClick={() => { onSwitchContext(isActive ? null : pin); onClose(); }}
              >
                {isActive ? "← Clear AI context" : "Set as AI context"}
              </Button>
              {isOwn && (
                <Button variant="destructive" onClick={() => { onDelete(pin.id); onClose(); }}>
                  Delete
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Camera / Upload Modal ─────────────────────────────────────────────────────
function CameraModal({ onClose, onCapture }: {
  onClose: () => void;
  onCapture: (base64: string, coords: { latitude: number; longitude: number } | null) => void;
}) {
  const [hasPermission, setPermission] = useState<boolean | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [preview, setPreview]           = useState<string | null>(null);
  const [coords, setCoords]             = useState<{ latitude: number; longitude: number } | null>(null);
  const webcamRef = useRef<Webcam>(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => {},
      { timeout: 6000, maximumAge: 60000, enableHighAccuracy: false }
    );
  }, []);

  function requestCamera() {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(() => { setPermission(true); setCameraActive(true); })
      .catch(() => setPermission(false));
  }

  const capture = useCallback(() => {
    const img = webcamRef.current?.getScreenshot();
    if (img) { setPreview(img); setCameraActive(false); }
  }, []);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-lg mx-4 flex flex-col gap-4">
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-card border border-border shadow text-muted-foreground hover:text-foreground"
        >✕</button>

        <Card>
          <CardContent className="flex flex-col items-center gap-4 pt-6 pb-6">
            <div className="relative w-full aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center border border-dashed border-border">
              {cameraActive && hasPermission ? (
                <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg"
                  videoConstraints={videoConstraints} className="w-full h-full object-cover" />
              ) : preview ? (
                <img src={preview} alt="preview" className="w-full h-full object-cover" />
              ) : (
                <p className="text-sm text-muted-foreground">Camera preview will appear here</p>
              )}
            </div>

            {cameraActive && hasPermission ? (
              <Button onClick={capture} className="w-full">Take snapshot</Button>
            ) : (
              <div className="flex gap-3 w-full">
                <Button variant="outline" className="flex-1" onClick={requestCamera}>Use camera</Button>
                <Button variant="outline" className="flex-1" onClick={() => document.getElementById("camFileInput")?.click()}>
                  Upload image
                </Button>
                <input id="camFileInput" type="file" accept="image/*" onChange={handleFile} className="hidden" />
              </div>
            )}

            {hasPermission === false && (
              <p className="text-sm text-destructive">No camera access — use file upload instead.</p>
            )}

            {preview && (
              <Button className="w-full" onClick={() => onCapture(preview, coords)}>
                Drop Pin with this image
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Main MapPanel ─────────────────────────────────────────────────────────────
export default function MapPanel({ onAnalysisResult, onPinContextSwitch }: MapPanelProps) {
  const mapRef         = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const leafletRef     = useRef<any>(null);
  const lMarkersRef    = useRef<Map<number, any>>(new Map());

  const [pins, setPins]                         = useState<Pin[]>([]);
  const [selectedPin, setSelectedPin]           = useState<Pin | null>(null);
  const [activeContextPin, setActiveContextPin] = useState<Pin | null>(null);
  const [cameraOpen, setCameraOpen]             = useState(false);

  const activeContextPinRef = useRef<Pin | null>(null);

  const [currentUserId] = useState<string>(() => {
    if (typeof window === "undefined") return crypto.randomUUID();
    let id = localStorage.getItem("map_user_id");
    if (!id) { id = crypto.randomUUID(); localStorage.setItem("map_user_id", id); }
    return id;
  });

  // ── Fetch + realtime ────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.from("pins").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setPins(data as Pin[]); });

    const ch = supabase.channel("pins-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pins" },
        (p) => setPins((prev) => [p.new as Pin, ...prev]))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "pins" },
        (p) => setPins((prev) => prev.filter((x) => x.id !== (p.old as Pin).id)))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pins" },
        (p) => setPins((prev) => prev.map((x) => x.id === (p.new as Pin).id ? p.new as Pin : x)))
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  // ── Sync Leaflet markers — re-runs whenever pins OR active context changes ──
  const syncMarkers = useCallback((pinList: Pin[], activePinId: number | null) => {
    const L   = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    const stale = new Set(lMarkersRef.current.keys());

    pinList.forEach((pin) => {
      const isActive = pin.id === activePinId;
      const color    = isActive ? ACTIVE_COLOR : pin.user_id === currentUserId ? MY_COLOR : OTHER_COLOR;
      const icon     = buildSvgIcon(color, L, isActive);

      if (lMarkersRef.current.has(pin.id)) {
        const lm = lMarkersRef.current.get(pin.id);
        lm.setIcon(icon);
        lm._pin = pin;
        // Bring active marker to front
        if (isActive) lm.setZIndexOffset(1000);
        else lm.setZIndexOffset(0);
        stale.delete(pin.id);
      } else {
        const lm = L.marker([pin.latitude, pin.longitude], { icon }).addTo(map);
        lm._pin = pin;
        if (isActive) lm.setZIndexOffset(1000);
        lm.on("click", () => setSelectedPin({ ...lm._pin }));
        lMarkersRef.current.set(pin.id, lm);
        stale.delete(pin.id);
      }
    });

    stale.forEach((id) => {
      lMarkersRef.current.get(id)?.remove();
      lMarkersRef.current.delete(id);
    });
  }, [currentUserId]);

  useEffect(() => {
    syncMarkers(pins, activeContextPin?.id ?? null);
  }, [pins, activeContextPin, syncMarkers]);

  // ── Init map with dark tiles ────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    import("leaflet").then((L) => {
      leafletRef.current = L;
      delete (L.Icon.Default.prototype as any)._getIconUrl;

      const map = L.map(mapRef.current!, { center: [32.8801, -117.234], zoom: 15, zoomControl: true });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
        className: "brightened-tiles"
      }).addTo(map);

      mapInstanceRef.current = map;
    });

    return () => { mapInstanceRef.current?.remove(); mapInstanceRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function compressImage(dataUrl: string, quality = 0.6, maxWidth = 800): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = dataUrl;
    });
  }

  // ── Drop pin ────────────────────────────────────────────────────────────────
  async function handleCapture(base64: string, gpsCoords: { latitude: number; longitude: number } | null) {
    const compressed = await compressImage(base64)
    setCameraOpen(false);

    let coords = gpsCoords;
    if (!coords) {
      coords = await new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          ()    => resolve(null),
          { timeout: 6000, maximumAge: 60000, enableHighAccuracy: false }
        );
      });
    }

    if (!coords) {
      alert("Could not get your location. Please allow location access in your browser and try again.");
      return;
    }

    const { data, error } = await supabase.from("pins").insert({
      image:     compressed,
      user_id:   currentUserId,
      latitude:  coords.latitude,
      longitude: coords.longitude,
      label:     "",
      note:      "",
      analysis:  "",
    }).select().single();

    if (error || !data) {
      console.error("Supabase insert error:", error);
      alert("Failed to save pin: " + (error?.message ?? "unknown error"));
      return;
    }

    const pinId = (data as Pin).id;

    try {
      const res  = await fetch(compressed);
      const blob = await res.blob();
      const form = new FormData();
      form.append("file", blob, "pin.jpg");
      form.append("latitude",  coords.latitude.toString());
      form.append("longitude", coords.longitude.toString());
      const r              = await fetch("http://localhost:8000/analyze", { method: "POST", body: form });
      const analysisResult = await r.json() as AnalysisResult;

      await supabase.from("pins").update({
        label:    analysisResult.scene_type  ?? "",
        note:     analysisResult.location    ?? "",
        analysis: analysisResult.description ?? "",
      }).eq("id", pinId);

      onAnalysisResult?.({ ...analysisResult, imageBase64: compressed }, pinId)
    } catch (e) {
      console.warn("Analysis failed — pin is still saved:", e);
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function handleDelete(id: number) {
    await supabase.from("pins").delete().eq("id", id);
    if (activeContextPin?.id === id) {
      setActiveContextPin(null);
      activeContextPinRef.current = null;
      onPinContextSwitch?.(null);
    }
  }

  // ── Context switch ──────────────────────────────────────────────────────────
  function handleContextSwitch(pin: Pin | null) {
    setActiveContextPin(pin);
    activeContextPinRef.current = pin;
    onPinContextSwitch?.(pin);
  }

  const myPins    = pins.filter((p) => p.user_id === currentUserId).length;
  const otherPins = pins.filter((p) => p.user_id !== currentUserId).length;

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />

      {/* Legend */}
      <div className="absolute top-4 right-4 z-[1000] bg-black/70 border border-white/10 rounded-lg px-3 py-2 shadow-sm flex flex-col gap-1.5 text-xs backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full inline-block" style={{ background: MY_COLOR }} />
          <span className="text-white/80">Mine ({myPins})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full inline-block" style={{ background: OTHER_COLOR }} />
          <span className="text-white/80">Others ({otherPins})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full inline-block" style={{ background: ACTIVE_COLOR }} />
          <span className="text-white/80">AI context</span>
        </div>
      </div>

      {/* Active context banner — shows image thumbnail + label */}
      {activeContextPin && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 bg-yellow-400 text-yellow-900 rounded-full pl-1 pr-4 py-1 shadow-lg text-sm font-semibold whitespace-nowrap">
          {activeContextPin.image && (
            <img
              src={activeContextPin.image}
              alt=""
              className="w-7 h-7 rounded-full object-cover border-2 border-yellow-900/30 shrink-0"
            />
          )}
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-900 animate-pulse inline-block" />
            AI viewing: {activeContextPin.label || "Pin"}
          </span>
          <button
            onClick={() => handleContextSwitch(null)}
            className="ml-1 text-yellow-900/70 hover:text-yellow-900 transition-colors text-xs underline"
          >
            clear
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="absolute bottom-6 left-3 z-[1000] flex flex-col gap-2">
        <button
          onClick={() => setCameraOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-black/70 border border-white/10 shadow-sm text-white hover:bg-black/90 transition-colors backdrop-blur-sm"
          title="Drop pin at my location"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M19 6h-1.586l-1-1c-.579-.579-1.595-1-2.414-1h-4c-.819 0-1.835.421-2.414 1l-1 1H5C3.346 6 2 7.346 2 9v8c0 1.654 1.346 3 3 3h14c1.654 0 3-1.346 3-3V9c0-1.654-1.346-3-3-3m-7 10a3.5 3.5 0 1 1 .001-7.001A3.5 3.5 0 0 1 12 16m6-4.701a1.3 1.3 0 1 1 0-2.6a1.3 1.3 0 0 1 0 2.6" />
          </svg>
        </button>
      </div>

      {/* Modals */}
      {cameraOpen && (
        <CameraModal onClose={() => setCameraOpen(false)} onCapture={handleCapture} />
      )}

      {selectedPin && (
        <PinModal
          pin={selectedPin}
          currentUserId={currentUserId}
          activeContextPinId={activeContextPin?.id ?? null}
          onClose={() => setSelectedPin(null)}
          onDelete={handleDelete}
          onSwitchContext={handleContextSwitch}
        />
      )}
    </div>
  );
}