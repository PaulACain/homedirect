import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Shield, Sparkles, Copy, RefreshCw, ChevronLeft, Users, Home, Briefcase } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type ICPTarget = "buyer" | "seller" | "concierge";
type HookAngle = "all" | "pain" | "savings" | "curiosity" | "social_proof" | "urgency";

interface HookVariant { angle: string; hook: string; }

interface GeneratedCopy {
  icp: ICPTarget;
  headlines: string[];
  hooks: HookVariant[];
  bodyVariants: string[];
  videoScript30: string;
  videoScript60: string;
  socialCaptions: string[];
  emailSubject: string;
  emailPreview: string;
  ctaVariants: string[];
  objectionHandlers: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ICP_LABELS: Record<ICPTarget, { label: string; description: string; icon: JSX.Element; color: string }> = {
  buyer:     { label: "Buyer",     description: "Tampa home buyers — save ~$9,818 in buyer agent fees", icon: <Home className="h-4 w-4" />,     color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  seller:    { label: "Seller",    description: "Tampa home sellers — keep ~$19,000 more at closing",   icon: <Users className="h-4 w-4" />,    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  concierge: { label: "Concierge", description: "Gig worker recruitment — $20/showing, your schedule",  icon: <Briefcase className="h-4 w-4" />, color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
};

const ANGLE_LABELS: Record<HookAngle, string> = {
  all:          "All angles (full set)",
  pain:         "Pain — lead with the problem",
  savings:      "Savings — lead with the dollar number",
  curiosity:    "Curiosity — open a loop",
  social_proof: "Social Proof — data & credibility",
  urgency:      "Urgency — market timing",
};

function CopyBlock({ label, content, mono = false }: { label: string; content: string; mono?: boolean }) {
  const { toast } = useToast();
  const copy = () => {
    navigator.clipboard.writeText(content);
    toast({ description: `${label} copied to clipboard` });
  };
  return (
    <div className="relative group rounded-md border border-border bg-muted/30 p-3">
      <p className={`text-sm pr-8 leading-relaxed whitespace-pre-wrap ${mono ? "font-mono text-xs" : ""}`}>{content}</p>
      <button
        onClick={copy}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
        title="Copy to clipboard"
      >
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}

function CopyList({ items, numbered = false }: { items: string[]; numbered?: boolean }) {
  const { toast } = useToast();
  const copyAll = () => {
    navigator.clipboard.writeText(items.join("\n\n"));
    toast({ description: "All items copied to clipboard" });
  };
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <CopyBlock key={i} label={numbered ? `Item ${i + 1}` : "Item"} content={numbered ? `${i + 1}. ${item}` : item} />
      ))}
      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={copyAll}>
        <Copy className="h-3 w-3 mr-1" /> Copy all
      </Button>
    </div>
  );
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {count !== undefined && (
        <Badge variant="secondary" className="text-xs">{count}</Badge>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function CopyGenerator() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [icp, setIcp] = useState<ICPTarget>("seller");
  const [angle, setAngle] = useState<HookAngle>("all");
  const [context, setContext] = useState("");
  const [result, setResult] = useState<GeneratedCopy | null>(null);

  // Auth guard
  if (!user) {
    return (
      <div className="py-24 text-center">
        <p className="text-sm text-muted-foreground">Please sign in to access the copy generator.</p>
      </div>
    );
  }
  if (user.role !== "admin") {
    return (
      <div className="py-24 text-center">
        <Shield className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold">Admin Access Required</h2>
        <p className="text-sm text-muted-foreground mt-1">The copy generator is available to admin users only.</p>
        <Button className="mt-4" onClick={() => setLocation("/")}>Go Home</Button>
      </div>
    );
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/marketing/generate-copy", {
        icp,
        angle: angle === "all" ? undefined : angle,
        context: context.trim() || undefined,
      });
      return res.json() as Promise<GeneratedCopy>;
    },
    onSuccess: (data) => {
      setResult(data);
      toast({ description: "Copy generated successfully" });
      // Scroll to results
      setTimeout(() => document.getElementById("copy-results")?.scrollIntoView({ behavior: "smooth" }), 100);
    },
    onError: (err: any) => {
      toast({ variant: "destructive", description: err?.message || "Generation failed — check API keys" });
    },
  });

  const selectedICP = ICP_LABELS[icp];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/admin")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#00C47A]" />
              <h1 className="text-2xl font-bold tracking-tight">Copy Generator</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">ICP-targeted ad copy, hooks, scripts, and captions powered by your brand docs</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Control Panel ── */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Generate Copy</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">

                {/* ICP Selector */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">Target Audience</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["buyer", "seller", "concierge"] as ICPTarget[]).map((t) => {
                      const meta = ICP_LABELS[t];
                      const active = icp === t;
                      return (
                        <button
                          key={t}
                          onClick={() => setIcp(t)}
                          className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-center transition-all text-xs font-medium ${
                            active
                              ? "border-[#00C47A] bg-[#00C47A]/10 text-[#00C47A]"
                              : "border-border bg-muted/20 text-muted-foreground hover:border-border/80 hover:bg-muted/40"
                          }`}
                        >
                          {meta.icon}
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{selectedICP.description}</p>
                </div>

                {/* Angle Selector */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">Hook Angle</label>
                  <Select value={angle} onValueChange={(v) => setAngle(v as HookAngle)}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ANGLE_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val} className="text-sm">{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Extra Context */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">Extra Context <span className="font-normal">(optional)</span></label>
                  <Textarea
                    placeholder='e.g. "Focus on out-of-state relocators from NYC" or "Emphasize the Tampa inventory glut"'
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    className="text-sm resize-none h-24"
                  />
                </div>

                {/* Generate Button */}
                <Button
                  className="w-full bg-[#00C47A] hover:bg-[#00C47A]/90 text-white font-medium"
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? (
                    <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-2" /> Generate Copy</>
                  )}
                </Button>

                {result && (
                  <Button variant="outline" className="w-full text-sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                    <RefreshCw className="h-3.5 w-3.5 mr-2" /> Regenerate
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Quick reference */}
            <Card className="border-dashed">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground font-medium mb-2">Powered by</p>
                <div className="space-y-1">
                  {["icp-buyer.md", "icp-seller.md", "icp-concierge.md", "icp-brand-psychology.md"].map(f => (
                    <p key={f} className="text-xs text-muted-foreground font-mono">{f}</p>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Results Panel ── */}
          <div className="lg:col-span-2" id="copy-results">
            {!result && !mutation.isPending && (
              <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-dashed border-border text-center">
                <Sparkles className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Select an ICP and angle, then hit Generate</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Takes ~15–25 seconds</p>
              </div>
            )}

            {mutation.isPending && (
              <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-dashed border-[#00C47A]/30 bg-[#00C47A]/5 text-center">
                <RefreshCw className="h-8 w-8 text-[#00C47A] animate-spin mb-3" />
                <p className="text-sm font-medium text-[#00C47A]">Generating copy for {ICP_LABELS[icp].label}s...</p>
                <p className="text-xs text-muted-foreground mt-1">Writing headlines, hooks, scripts, captions</p>
              </div>
            )}

            {result && !mutation.isPending && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 mb-4">
                  <Badge className={`text-xs ${ICP_LABELS[result.icp].color}`}>
                    {ICP_LABELS[result.icp].label}
                  </Badge>
                  {angle !== "all" && (
                    <Badge variant="outline" className="text-xs">{ANGLE_LABELS[angle]}</Badge>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                <Tabs defaultValue="ads">
                  <TabsList className="w-full grid grid-cols-4 mb-4">
                    <TabsTrigger value="ads" className="text-xs">Ads</TabsTrigger>
                    <TabsTrigger value="video" className="text-xs">Video</TabsTrigger>
                    <TabsTrigger value="social" className="text-xs">Social</TabsTrigger>
                    <TabsTrigger value="email" className="text-xs">Email / CTA</TabsTrigger>
                  </TabsList>

                  {/* ── Ads Tab ── */}
                  <TabsContent value="ads" className="space-y-6 mt-0">
                    <div>
                      <SectionHeader title="Headlines" count={result.headlines.length} />
                      <CopyList items={result.headlines} numbered />
                    </div>
                    <div>
                      <SectionHeader title="Hooks by Angle" count={result.hooks.length} />
                      <div className="space-y-2">
                        {result.hooks.map((h, i) => (
                          <div key={i}>
                            <Badge variant="outline" className="text-xs mb-1 capitalize">{h.angle.replace("_", " ")}</Badge>
                            <CopyBlock label={h.angle} content={h.hook} />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <SectionHeader title="Body Copy Variants" count={result.bodyVariants.length} />
                      <div className="space-y-3">
                        {result.bodyVariants.map((v, i) => (
                          <div key={i}>
                            <p className="text-xs text-muted-foreground mb-1">Variant {String.fromCharCode(65 + i)}</p>
                            <CopyBlock label={`Variant ${String.fromCharCode(65 + i)}`} content={v} />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <SectionHeader title="Objection Handlers" count={result.objectionHandlers.length} />
                      <CopyList items={result.objectionHandlers} />
                    </div>
                  </TabsContent>

                  {/* ── Video Tab ── */}
                  <TabsContent value="video" className="space-y-6 mt-0">
                    <div>
                      <SectionHeader title="30-Second UGC Script" />
                      <CopyBlock label="30s Script" content={result.videoScript30} mono />
                    </div>
                    <div>
                      <SectionHeader title="60-Second UGC Script" />
                      <CopyBlock label="60s Script" content={result.videoScript60} mono />
                    </div>
                  </TabsContent>

                  {/* ── Social Tab ── */}
                  <TabsContent value="social" className="space-y-4 mt-0">
                    <SectionHeader title="Social Media Captions" count={result.socialCaptions.length} />
                    <div className="space-y-3">
                      {result.socialCaptions.map((cap, i) => {
                        const platforms = ["IG / FB — Storytelling", "IG / FB — Question", "TikTok", "LinkedIn", "UGC Style"];
                        return (
                          <div key={i}>
                            <Badge variant="outline" className="text-xs mb-1">{platforms[i] || `Caption ${i + 1}`}</Badge>
                            <CopyBlock label={platforms[i] || `Caption ${i + 1}`} content={cap} />
                          </div>
                        );
                      })}
                    </div>
                  </TabsContent>

                  {/* ── Email / CTA Tab ── */}
                  <TabsContent value="email" className="space-y-6 mt-0">
                    <div>
                      <SectionHeader title="Email Subject Line" />
                      <CopyBlock label="Subject" content={result.emailSubject} />
                    </div>
                    <div>
                      <SectionHeader title="Email Preview Text" />
                      <CopyBlock label="Preview" content={result.emailPreview} />
                    </div>
                    <div>
                      <SectionHeader title="CTA Button Variants" count={result.ctaVariants.length} />
                      <div className="flex flex-wrap gap-2">
                        {result.ctaVariants.map((cta, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              navigator.clipboard.writeText(cta);
                              toast({ description: `"${cta}" copied` });
                            }}
                            className="px-4 py-2 rounded-md text-sm font-medium bg-[#00C47A] text-white hover:bg-[#00C47A]/80 transition-colors"
                          >
                            {cta}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">Click any button to copy its text</p>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
