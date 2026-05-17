"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/map`,
      },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
  }

  if (user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <Card className="w-full max-w-sm">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white">Pinnical</h1>
            <p className="mt-1 text-white">The Pinnacle of Connecting With Others </p>
          </div>
          <CardHeader>
            <CardTitle className="text-base font-medium">Signed in as {user.user_metadata.full_name}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button onClick={() => window.location.href = "/map"}>Go to Map</Button>
            <Button variant="outline" onClick={signOut}>Sign out</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white">Pinnical</h1>
            <p className="mt-1 text-white">The Pinnacle of Connecting With Others </p>
          </div>
        <CardHeader>
          <CardTitle className="text-center text-xl font-semibold">Chat Room</CardTitle>
          <p className="text-center text-sm text-muted-foreground">Connect with ohters</p>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => {
            console.log("button clicked");
            signInWithGoogle();
          }}>
            Sign in with Google
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}