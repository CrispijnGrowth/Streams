import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";

export function AuthVerifyPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { login } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function verifyToken() {
      const params = new URLSearchParams(search);
      const token = params.get("token");

      if (!token) {
        setStatus("error");
        setMessage("No token provided");
        return;
      }

      try {
        const res = await fetch("/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();

        if (res.ok) {
          login(data.sessionId, data.user);
          setStatus("success");
          setMessage("Login successful! Redirecting...");
          setTimeout(() => setLocation("/"), 1500);
        } else {
          setStatus("error");
          setMessage(data.error || "Verification failed");
        }
      } catch {
        setStatus("error");
        setMessage("Verification failed");
      }
    }

    verifyToken();
  }, [search, login, setLocation]);

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Verifying Login</CardTitle>
          <CardDescription>Please wait while we verify your magic link</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {status === "loading" && (
            <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
          )}
          {status === "success" && (
            <Alert className="border-green-500">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                {message}
              </AlertDescription>
            </Alert>
          )}
          {status === "error" && (
            <>
              <Alert className="border-destructive">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <AlertDescription>{message}</AlertDescription>
              </Alert>
              <Button variant="outline" onClick={() => setLocation("/login")} data-testid="button-back-to-login">
                Back to Login
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
