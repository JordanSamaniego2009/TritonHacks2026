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
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">


      {/*Debugging To Different Pages*/}
      <CardContent className="flex flex-col gap-3">
        <Button onClick={() => window.location.href = "/testSignIn"}>Go to chat</Button>
      </CardContent>
      <CardContent className="flex flex-col gap-3">
        <Button onClick={() => window.location.href = "/testAIModel"}>Go to AI Training</Button>
      </CardContent>

    </main>
  );
}