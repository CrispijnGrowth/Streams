import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, CheckCircle, AlertCircle, UserPlus, LogIn } from "lucide-react";

export function LoginPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading, login } = useAuth();
  const [activeTab, setActiveTab] = useState("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [magicLink, setMagicLink] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      setLocation("/");
    }
  }, [user, authLoading, setLocation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);
    setMagicLink(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: data.message });
        if (data.debug) {
          setMagicLink(data.debug);
        }
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to send login link" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: data.message });
        setEmail("");
        setName("");
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch {
      setMessage({ type: "error", text: "Registration failed" });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Streams</CardTitle>
          <CardDescription>Project orchestration for Sovereign Cloud</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="login" data-testid="tab-login">
                <LogIn className="h-4 w-4 mr-2" />
                Login
              </TabsTrigger>
              <TabsTrigger value="register" data-testid="tab-register">
                <UserPlus className="h-4 w-4 mr-2" />
                Register
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    data-testid="input-login-email"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-login">
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Mail className="h-4 w-4 mr-2" />
                  )}
                  Send Magic Link
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-name">Full Name</Label>
                  <Input
                    id="register-name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    data-testid="input-register-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    data-testid="input-register-email"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-register">
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <UserPlus className="h-4 w-4 mr-2" />
                  )}
                  Request Access
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  New accounts require admin approval before access is granted.
                </p>
              </form>
            </TabsContent>
          </Tabs>

          {message && (
            <Alert className={`mt-4 ${message.type === "success" ? "border-green-500" : "border-destructive"}`}>
              {message.type === "success" ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
              <AlertDescription className={message.type === "success" ? "text-green-700 dark:text-green-400" : ""}>
                {message.text}
              </AlertDescription>
            </Alert>
          )}

          {magicLink && (
            <div className="mt-4 p-3 bg-muted rounded-md">
              <p className="text-xs text-muted-foreground mb-2">Debug: Click below to login (in production, this would be emailed)</p>
              <a
                href={magicLink}
                className="text-sm text-primary underline break-all"
                data-testid="link-magic"
              >
                Open Magic Link
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
