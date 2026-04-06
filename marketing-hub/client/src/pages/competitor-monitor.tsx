import { Search, Zap, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const COMPETITORS = ["Zillow", "Redfin", "Opendoor", "ForSaleByOwner.com", "Houzeo", "Offerpad"];

export default function CompetitorMonitor() {
  return (
    <div className="px-8 py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Search className="h-5 w-5 text-teal" /> Competitor Monitor
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Automated weekly pull from Meta Ad Library + Google Ads Transparency on your competitors
        </p>
      </div>

      {/* Coming Soon Banner */}
      <div className="mb-8 rounded-lg border border-[hsl(192,100%,50%)]/30 bg-[hsl(192,100%,50%)]/5 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="h-4 w-4 text-teal" />
          <span className="text-sm font-semibold text-teal">Building Next</span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          This tool will automatically pull every active ad from these competitors weekly using the Meta Ad Library API (free, no authentication) and Google Ads Transparency Center. An LLM then extracts hook, offer, CTA, format, and emotion from each ad and delivers a digest every Monday.
        </p>
      </div>

      {/* What it will do */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {[
          { step: "01", title: "Pull Competitor Ads",       desc: "Weekly cron hits Meta Ad Library API for all 6 competitors. No login, no cost." },
          { step: "02", title: "LLM Extraction",            desc: "Each ad is analyzed: hook type, offer, CTA, emotional angle, estimated run duration." },
          { step: "03", title: "Trend Detection",           desc: "Compare against prior weeks — what new creative emerged? What stopped running?" },
          { step: "04", title: "Monday Morning Digest",     desc: "Structured report delivered here: top 5 hooks in market, creative format trends, opportunities." },
        ].map(({ step, title, desc }) => (
          <Card key={step} className="border-border bg-muted/10">
            <CardContent className="p-4">
              <p className="text-[10px] font-bold text-teal tracking-widest mb-2">{step}</p>
              <p className="text-sm font-semibold text-foreground mb-1">{title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Competitor list */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Competitors to Monitor</p>
        <div className="flex flex-wrap gap-2">
          {COMPETITORS.map(c => (
            <Badge key={c} variant="outline" className="text-xs px-3 py-1 border-border text-muted-foreground">
              {c}
            </Badge>
          ))}
          <Badge variant="outline" className="text-xs px-3 py-1 border-dashed border-border text-muted-foreground/50 cursor-not-allowed">
            + Add competitor
          </Badge>
        </div>
      </div>

      {/* Data source */}
      <div className="mt-8 pt-6 border-t border-border">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Data Sources</p>
        <div className="space-y-2">
          {[
            { name: "Meta Ad Library API",             cost: "Free",    url: "facebook.com/ads/library/api" },
            { name: "Google Ads Transparency Center",  cost: "Free",    url: "adstransparency.google.com"  },
          ].map(({ name, cost, url }) => (
            <div key={name} className="flex items-center gap-3 text-xs">
              <span className="text-foreground/80 flex-1">{name}</span>
              <span className="text-muted-foreground font-mono">{url}</span>
              <Badge variant="secondary" className="text-[10px]">{cost}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
