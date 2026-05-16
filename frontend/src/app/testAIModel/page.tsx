"use client";
import { useEffect, useState, useRef, useCallback} from "react";
import Webcam from "react-webcam";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const videoConstraints = {
  facingMode: { ideal: "environment" }
};

export default function Home() {
  const [result, setResult] = useState<{ label: string; confidence: number} | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [hasPermission, setPermission] = useState<boolean | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const webcamRef = useRef<Webcam>(null);

  // Location Getter:
 async function getCoordinates(): Promise<{ latitude: number; longitude: number } | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => resolve(null)
      );
    });
  }

  // Camera/Image Upload Logic
  function requestCamera() {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then(() => {
        setPermission(true);
        setCameraActive(true);
      })
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

    const res = await fetch("http://localhost:8000/analyze", {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    setResult(data);
    setLoading(false);
  }

  // Backend Communications
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

    const response = await fetch("http://localhost:8000/analyze", {
      method: "POST",
      body: formData
    });

    const data = await response.json();
    setResult(data);

    setLoading(false);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      {/* Camera UI Component */}
      <Card className="w-full max-w-lg">
        <CardContent className="flex flex-col items-center gap-4 pt-6">

          {/* Image Box Component */}
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
              <img
                src={preview}
                alt="preview"
                className="w-full h-full object-cover"
              />
            ) : (
             /* Placeholder */
              <div className="text-center text-muted-foreground flex flex-col items-center gap-2">
                <p className="text-sm font-medium">Camera preview will appear here</p>
              </div>
            )}
          </div>

          {/* Camera and Upload Components */}
          <div className="w-full flex flex-col gap-3">
            {cameraActive && hasPermission ? (
              <Button onClick={capture} className="w-full">
                Take snapshot
              </Button>
            ) : (
              <div className="flex gap-3 w-full">
                <Button variant="outline" className="flex-1" onClick={requestCamera}>
                  Use camera
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => document.getElementById("fileInput")?.click()}
                >
                  Upload image
                </Button>
                <input
                  id="fileInput"
                  type="file"
                  accept="image/*"
                  onChange={uploadImage}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {hasPermission === false && (
            <p className="text-sm text-destructive">No camera access — use file upload instead.</p>
          )}
        </CardContent>
      </Card>

      {/*Loading Animation*/}
      {loading && <p className="text-blue-500 animate-bounce">Analyzing...</p>}

      {/*Display Results*/}
      {result && (
        <Card className="w-full max-w-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">Result</CardTitle>
            <Badge variant="secondary">{result.confidence}%</Badge>
            <Badge variant="secondary">{result.label}</Badge>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-2xl font-bold capitalize">{result.label}</p>
          </CardContent>
        </Card>
      )}

    <CardContent className="flex flex-col gap-3">
        <Button onClick={() => window.location.href = "/"}>Go back home</Button>
      </CardContent>

    </main>
  );
}