import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface AuthModalProps {
  mode: "login" | "register";
  onClose: () => void;
  onSwitch: (mode: "login" | "register") => void;
}

export function AuthModal({ mode, onClose, onSwitch }: AuthModalProps) {
  const { login, register } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("buyer");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
        toast({ title: "Welcome back", description: "You've been signed in successfully." });
      } else {
        await register({ email, password, fullName, phone, role });
        toast({ title: "Account created", description: "Welcome to HomeDirectAI." });
      }
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-auth">
        <DialogHeader>
          <DialogTitle data-testid="text-auth-title">
            {mode === "login" ? "Sign in to your account" : "Create your account"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="John Smith" data-testid="input-fullname" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(813) 555-0100" data-testid="input-phone" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">I want to</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger data-testid="select-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buyer">Buy a home</SelectItem>
                    <SelectItem value="seller">Sell a home</SelectItem>
                    <SelectItem value="chaperone">Earn as a chaperone ($20/walkthrough)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" data-testid="input-email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Enter password" data-testid="input-password" />
          </div>

          <Button type="submit" className="w-full" disabled={loading} data-testid="button-auth-submit">
            {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
          </Button>

          {mode === "login" && (
            <div className="rounded-md border p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Demo accounts:</p>
              <p className="text-xs text-muted-foreground">Buyer: mike@example.com / demo123</p>
              <p className="text-xs text-muted-foreground">Seller: sarah@example.com / demo123</p>
              <p className="text-xs text-muted-foreground">Chaperone: lisa@example.com / demo123</p>
            </div>
          )}

          <p className="text-center text-sm text-muted-foreground">
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              className="font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => onSwitch(mode === "login" ? "register" : "login")}
              data-testid="button-auth-switch"
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
