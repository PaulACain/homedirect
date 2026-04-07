import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Sparkles, Search, FileText, BarChart2, ArrowRight, AlertCircle, CheckCircle2, Layers, RefreshCw, Clapperboard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const TOOLS = [
  {
    href: "/copy-generator",
    icon: Sparkles,
    label: "Copy Generator",
    description: "ICP-targeted ad copy, hooks, video scripts, social captions, and CTAs for Buyer, Seller, and Concierge audiences.",
    live: true,
    accent: "text-signal",
    bg: "bg-[hsl(152,100%,39%)]/10 border-[hsl(152,100%,39%)]/20",
  },
  {
    href: "/video-generator",
    icon: Clapperboard,
    label: "Video Generator",
    description: "Script → voiceover → b-roll → composed .mp4. No avatars, no actors. Reels and feed ads from your briefs in 60 seconds.",
    live: true,
    accent: "text-[hsl(192,100%,50%)]",
    bg: "bg-[hsl(192,100%,50%)]/10 border-[hsl(192,100%,50%)]/20",
  },
  {
    href: "/competitor-monitor",
    icon: Search,
    label: "Competitor Monitor",
    description: "Weekly automated pull of Meta Ad Library + Google Ads Transparency on Zillow, Redfin, Opendoor, FSBO competitors. LLM digest.",
    live: true,
    accent: "text-teal",
    bg: "bg-[hsl(192,100%,50%)]/10 border-[hsl(192,100%,50%)]/20",
  },
  {
    href: "/brief-generator",
    icon: FileText,
    label: "Brief Generator",
    description: "Turn copy output into production-ready creative briefs for Carousel, Reel/Video, and Static Ad formats. One-click export for Canva, AdCreative.ai, and Creatify.",
    live: true,
    accent: "text-[hsl(45,90%,61%)]",
    bg: "bg-[hsl(45,90%,61%)]/10 border-[hsl(45,90%,61%)]/20",
  },
  {
    href: "/performance-board",
    icon: BarChart2,
    label: "Performance Board",
    description: "Track CTR, CPL, ROAS, and spend by creative, ICP, and format. Manual entry + Meta Ads API integration.",
    live: true,
    accent: "text-[hsl(192,100%,50%)]",
    bg: "bg-[hsl(192,100%,50%)]/10 border-[hsl(192,100%,50%)]/20",
  },
  {
    href: "/asset-library",
    icon: Layers,
    label: "Asset Library",
    description: "Track creative assets through their lifecycle — draft, live, winner, loser — with ICP and format tagging.",
    live: true,
    accent: "text-amber-400",
    bg: "bg-amber-900/15 border-amber-800/20",
  },
  {
    href: "/feedback-loop",
    icon: RefreshCw,
    label: "Feedback Loop",
    description: "Weekly automated analysis of ad performance → generates new creative briefs and queues content for next week.",
    live: true,
    accent: "text-[hsl(192,100%,50%)]",
    bg: "bg-[hsl(192,100%,50%)]/10 border-[hsl(192,100%,50%)]/20",
  },
];

export default function Dashboard() {
  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: () => apiRequest("GET", "/api/settings").then(r => r.json()),
  });

  const { data: history } = useQuery({
    queryKey: ["/api/history"],
    queryFn: () => apiRequest("GET", "/api/history").then(r => r.json()),
  });

  const generationCount = history?.length || 0;

  return (
    <div className="px-8 py-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-bold text-foreground">Marketing Hub</h1>
        <p className="text-sm text-muted-foreground mt-1">
          HomeDirectAI's internal creative and advertising operations center.
        </p>
      </div>

      {/* API key warning */}
      {settings && !settings.hasKey && (
        <div className="mb-6 flex items-start gap-3 px-4 py-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
          <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-300">No API key configured</p>
            <p className="text-xs text-amber-400/80 mt-0.5">
              Add your Together AI, OpenAI, or DeepSeek key in{" "}
              <Link href="/settings"><a className="underline hover:text-amber-300">Settings</a></Link>
              {" "}to enable the copy generator.
            </p>
          </div>
        </div>
      )}

      {settings?.hasKey && (
        <div className="mb-6 flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[hsl(152,100%,39%)]/30 bg-[hsl(152,100%,39%)]/10 w-fit">
          <CheckCircle2 className="h-3.5 w-3.5 text-signal" />
          <p className="text-xs text-signal font-medium">API key connected · {settings.provider}</p>
          {generationCount > 0 && (
            <Badge variant="secondary" className="text-[10px] ml-1">{generationCount} generations</Badge>
          )}
        </div>
      )}

      {/* Tools grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TOOLS.map(({ href, icon: Icon, label, description, live, accent, bg }) => (
          live ? (
            <Link key={label} href={href}>
              <a className="block group">
                <Card className={`border cursor-pointer transition-all hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 ${bg}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`p-2 rounded-lg bg-background/50 ${accent}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-signal animate-pulse" />
                        <span className="text-[10px] text-signal font-semibold uppercase tracking-wide">Live</span>
                      </div>
                    </div>
                    <h3 className="text-sm font-semibold text-foreground mb-1.5 flex items-center gap-2">
                      {label}
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
                  </CardContent>
                </Card>
              </a>
            </Link>
          ) : (
            <Card key={label} className={`border opacity-60 ${bg}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-lg bg-background/50 ${accent}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide bg-muted px-2 py-0.5 rounded">Coming Soon</span>
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1.5">{label}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
              </CardContent>
            </Card>
          )
        ))}
      </div>

      {/* Pipeline status */}
      <div className="mt-8 pt-6 border-t border-border">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Pipeline Status</p>
        <div className="space-y-2">
          {[
            { label: "Copy Generator",       status: "live" },
            { label: "Brief Generator",      status: "live" },
            { label: "Video Generator",      status: "live" },
            { label: "Competitor Monitor",   status: "live" },
            { label: "Performance Board",    status: "live" },
            { label: "Asset Library",        status: "live" },
            { label: "Feedback Loop (Auto)", status: "live" },
          ].map(({ label, status }) => (
            <div key={label} className="flex items-center gap-3">
              <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                status === "live"     ? "bg-signal" :
                status === "building" ? "bg-amber-400" :
                "bg-muted-foreground/40"
              }`} />
              <span className="text-xs text-muted-foreground flex-1">{label}</span>
              <span className={`text-[10px] font-medium uppercase tracking-wide ${
                status === "live"     ? "text-signal" :
                status === "building" ? "text-amber-400" :
                "text-muted-foreground/50"
              }`}>{status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
