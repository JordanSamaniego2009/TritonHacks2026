"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import "leaflet/dist/leaflet.css";
import Webcam from "react-webcam";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const videoConstraints = { facingMode: { ideal: "environment" } };

type AnalysisResult = {
  scene_type: string;
  culture: string;
  historical_context: string;
  description: string;
  weather: string;
  flora_fauna: string[];
  confidence: number;
  location: string;
  error?: string;
};
type MapPanelProps = {
  onAnalysisResult?: (AnalysisResult: { label: string; confidence: number; location: string }) => void;
};

function CameraModal({ onClose, onResult }: { 
  onClose: () => void; 
  onResult?: (AnalysisResult: AnalysisResult) => void;
}) {
  const [result, setResult] = useState<{ label: string; confidence: number; location: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [hasPermission, setPermission] = useState<boolean | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const webcamRef = useRef<Webcam>(null);

  async function getCoordinates(): Promise<{ latitude: number; longitude: number } | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => resolve(null)
      );
    });
  }

  function requestCamera() {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then(() => { setPermission(true); setCameraActive(true); })
      .catch(() => setPermission(false));
  }

  const capture = useCallback(() => {
    if (webcamRef.current) {
      const image = webcamRef.current.getScreenshot();
      if (!image) return;
      setPreview(image);
      setCameraActive(false);
      sendDataToBackend(image);
    }
  }, [webcamRef]);

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setLoading(true);
    setResult(null);
    const coords = await getCoordinates();
    const formData = new FormData();
    formData.append("file", file);
    if (coords) {
      formData.append("latitude", coords.latitude.toString());
      formData.append("longitude", coords.longitude.toString());
    }
    const res = await fetch("http://localhost:8000/analyze", { method: "POST", body: formData });

    const data = await res.json();

    

    setResult(data);
    onResult?.(data);
    setLoading(false);
  }

  async function sendDataToBackend(base64: string) {
    setLoading(true);
    setResult(null);
    const coords = await getCoordinates();
    const res = await fetch(base64);
    const blob = await res.blob();
    const formData = new FormData();
    formData.append("file", blob, "snapshot.jpg");
    if (coords) {
      formData.append("latitude", coords.latitude.toString());
      formData.append("longitude", coords.longitude.toString());
    }
    const response = await fetch("http://localhost:8000/analyze", { method: "POST", body: formData });
    
    const data = await response.json();

    setResult(data);
    onResult?.(data);
    setLoading(false);
  }

  return (
    <div
      className="fixed inset-0 z-2000 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-lg mx-4 flex flex-col gap-4">
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-card border border-border shadow text-muted-foreground hover:text-foreground transition-colors"
        >
          ✕
        </button>

        <Card>
          <CardContent className="flex flex-col items-center gap-4 pt-6">
            <div className="relative w-full aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center border border-dashed border-border">
              {cameraActive && hasPermission ? (
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={videoConstraints}
                  className="w-full h-full object-cover"
                />
              ) : preview ? (
                <img src={preview} alt="preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center text-muted-foreground flex flex-col items-center gap-2">
                  <p className="text-sm font-medium">Camera preview will appear here</p>
                </div>
              )}
            </div>

            <div className="w-full flex flex-col gap-3">
              {cameraActive && hasPermission ? (
                <Button onClick={capture} className="w-full">Take snapshot</Button>
              ) : (
                <div className="flex gap-3 w-full">
                  <Button variant="outline" className="flex-1" onClick={requestCamera}>Use camera</Button>
                  <Button variant="outline" className="flex-1" onClick={() => document.getElementById("fileInput")?.click()}>
                    Upload image
                  </Button>
                  <input id="fileInput" type="file" accept="image/*" onChange={uploadImage} className="hidden" />
                </div>
              )}
            </div>

            {hasPermission === false && (
              <p className="text-sm text-destructive">No camera access — use file upload instead.</p>
            )}
          </CardContent>
        </Card>

        {loading && <p className="text-center text-blue-500 animate-bounce">Analyzing...</p>}

        {result && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-medium">Result</CardTitle>
              <Badge variant="secondary">{result.confidence}%</Badge>
              <Badge variant="secondary">{result.label}</Badge>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center">
              <p className="text-2xl font-bold capitalize">{result.label}</p>
              <p className="text-xl">{result.location}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function MapPanel({ onAnalysisResult }: MapPanelProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    import("leaflet").then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current!, {
        center: [32.8801, -117.234],
        zoom: 15,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
    });

    return () => {
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />
      {modalOpen && (
        <CameraModal 
          onClose={() => setModalOpen(false)} 
          onResult={(result) => {
            onAnalysisResult?.(result);
          }} 
        />
      )}
      <div className="absolute bottom-6 left-3 z-1000">
        <button
          onClick={() => setModalOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-card border border-border shadow-sm text-foreground hover:bg-muted transition-colors"
          title="Open camera"
        >
        {/*https://viconic.dev/icon/typicons/camera*/}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48"><path fill="currentColor" d="M19 6h-1.586l-1-1c-.579-.579-1.595-1-2.414-1h-4c-.819 0-1.835.421-2.414 1l-1 1H5C3.346 6 2 7.346 2 9v8c0 1.654 1.346 3 3 3h14c1.654 0 3-1.346 3-3V9c0-1.654-1.346-3-3-3m-7 10a3.5 3.5 0 1 1 .001-7.001A3.5 3.5 0 0 1 12 16m6-4.701a1.3 1.3 0 1 1 0-2.6a1.3 1.3 0 0 1 0 2.6" /></svg>
        </button>
      </div>
    </div>
  );
}