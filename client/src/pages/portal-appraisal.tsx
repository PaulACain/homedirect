import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, BarChart3, CheckCircle2, TrendingUp, TrendingDown, Send,
  Bot, User, Loader2, AlertTriangle, Info
} from "lucide-react";
import type { Transaction } from "@shared/schema";

type PortalMessage = { id: number; role: string; content: string; createdAt: string };

function formatPrice(p: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(p);
}

function renderMarkdown(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br/>");
}

const APPRAISAL_STEPS = ["Ordered", "Scheduled", "Completed", "Report Received"];

const MOCK_COMPS = [
  { address: "712 13th Ave NE", price: 578000, sqft: 1920, pricePerSqft: 301, date: "Mar 2026" },
  { address: "834 17th Ave NE", price: 545000, sqft: 1800, pricePerSqft: 303, date: "Feb 2026" },
  { address: "621 16th Ave NE", price: 595000, sqft: 1980, pricePerSqft: 300, date: "Jan 2026" },
  { address: "906 14th Ave NE", price: 562000, sqft: 1875, pricePerSqft: 299, date: "Mar 2026" },
];

function getAppraisalStep(status: string | null | undefined): number {
  if (!status || status === "not_started") return -1;
  if (status === "in_progress") return 1;
  if (status === "completed") return 3;
  return 0;
}

export default function PortalAppraisal() {
  const [, params] = useRoute("/transaction/:id/appraisal");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [chatMessage, setChatMessage] = useState("");
  // Mock: show completed appraisal
  const [appraisedValue] = useState<number | null>(570000);

  const txnId = params?.id;

  const { data: txn } = useQuery<Transaction>({
    queryKey: ["/api/transactions", txnId],
    queryFn: () => apiRequest("GET", `/api/transactions/${txnId}`).then((r) => r.json()),
    enabled: !!txnId,
  });

  const { data: messages = [], refetch: refetchMsgs } = useQuery<PortalMessage[]>({
    queryKey: ["/api/transactions", txnId, "portal-messages", "appraisal"],
    queryFn: () => apiRequest("GET", `/api/transactions/${txnId}/portal-messages/appraisal`).then((r) => r.json()),
    enabled: !!txnId && !!user,
  });

  const sendChat = useMutation({
    mutationFn: (msg: string) =>
      apiRequest("POST", `/api/transactions/${txnId}/portal-chat`, { portal: "appraisal", message: msg }).then((r) => r.json()),
    onSuccess: () => { refetchMsgs(); setChatMessage(""); },
    onError: () => toast({ title: "Error", description: "Failed to send message", variant: "destructive" }),
  });

  const handleSendChat = () => {
    const msg = chatMessage.trim();
    if (!msg) return;
    sendChat.mutate(msg);
  };

  if (!txn) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const salePrice = txn.salePrice;
  const currentStep = getAppraisalStep(txn.appraisalStatus);

  // Appraisal outcome
  const appraisalDiff = appraisedValue !== null ? appraisedValue - salePrice : null;
  const isLow = appraisedValue !== null && appraisedValue < salePrice;
  const isAtOrAbove = appraisedValue !== null && appraisedValue >= salePrice;

  const avgCompPrice = Math.round(MOCK_COMPS.reduce((s, c) => s + c.price, 0) / MOCK_COMPS.length);
  const avgPricePerSqft = Math.round(MOCK_COMPS.reduce((s, c) => s + c.pricePerSqft, 0) / MOCK_COMPS.length);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6" data-testid="portal-appraisal">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation(`/transaction/${txnId}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-orange-50 border border-orange-200">
            <BarChart3 className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Appraisal Portal</h1>
            <p className="text-xs text-muted-foreground">Property valuation report and comparable analysis</p>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {/* Status Tracker */}
        <Card style={{ borderRadius: "14px" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Appraisal Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative flex items-center justify-between">
              <div className="absolute top-3.5 left-0 right-0 h-0.5 bg-muted" />
              <div
                className="absolute top-3.5 left-0 h-0.5 transition-all"
                style={{
                  backgroundColor: "hsl(160, 60%, 28%)",
                  width: appraisedValue ? "100%" : currentStep <= 0 ? "0%" : `${(currentStep / (APPRAISAL_STEPS.length - 1)) * 100}%`,
                }}
              />
              {APPRAISAL_STEPS.map((step, idx) => {
                const complete = appraisedValue !== null ? true : idx <= currentStep;
                return (
                  <div key={step} className="relative flex flex-col items-center gap-2 z-10">
                    <div
                      className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 border-white ${
                        complete ? "text-white" : "bg-muted text-muted-foreground"
                      }`}
                      style={complete ? { backgroundColor: "hsl(160, 60%, 28%)" } : {}}
                    >
                      {complete ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                    </div>
                    <span
                      className={`text-[10px] font-medium text-center max-w-[70px] leading-tight ${complete ? "text-primary" : "text-muted-foreground"}`}
                      style={complete ? { color: "hsl(160, 60%, 28%)" } : {}}
                    >
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Appraisal Result */}
        {appraisedValue !== null && (
          <Card
            style={{ borderRadius: "14px" }}
            className={`border-2 ${isAtOrAbove ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"}`}
          >
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${isAtOrAbove ? "bg-emerald-100" : "bg-amber-100"}`}>
                  {isAtOrAbove ? (
                    <TrendingUp className="h-6 w-6 text-emerald-600" />
                  ) : (
                    <TrendingDown className="h-6 w-6 text-amber-600" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Appraised Value</p>
                      <p className="text-2xl font-bold">{formatPrice(appraisedValue)}</p>
                    </div>
                    <div className="text-muted-foreground">vs.</div>
                    <div>
                      <p className="text-xs text-muted-foreground">Purchase Price</p>
                      <p className="text-2xl font-bold">{formatPrice(salePrice)}</p>
                    </div>
                  </div>

                  {isAtOrAbove ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <p className="text-sm text-emerald-700 font-medium">
                        Appraisal meets or exceeds purchase price — your loan is fully supported.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <p className="text-sm text-amber-700 font-medium">
                          Low appraisal — {formatPrice(Math.abs(appraisalDiff!))} gap between appraised value and purchase price
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => sendChat.mutate("What are my options with a low appraisal?")}>
                          Ask AI About Options
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => sendChat.mutate("How do I challenge a low appraisal?")}>
                          Challenge the Appraisal
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Not Yet Ordered State */}
        {currentStep < 0 && appraisedValue === null && (
          <Card style={{ borderRadius: "14px" }} className="border-dashed">
            <CardContent className="p-8 text-center">
              <BarChart3 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="font-medium">Appraisal Not Yet Ordered</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your lender will order the appraisal once your mortgage application is submitted. 
                Typically ordered within 7-14 days of contract acceptance.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Comparable Properties */}
        <Card style={{ borderRadius: "14px" }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Comparable Properties (AI-Generated)</CardTitle>
              <div className="flex items-center gap-1">
                <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">AI estimated</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 text-xs text-muted-foreground font-medium">Address</th>
                    <th className="text-right py-2 pr-4 text-xs text-muted-foreground font-medium">Sale Price</th>
                    <th className="text-right py-2 pr-4 text-xs text-muted-foreground font-medium">Sq Ft</th>
                    <th className="text-right py-2 pr-4 text-xs text-muted-foreground font-medium">$/Sq Ft</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_COMPS.map((comp, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2.5 pr-4 font-medium">{comp.address}</td>
                      <td className="py-2.5 pr-4 text-right">{formatPrice(comp.price)}</td>
                      <td className="py-2.5 pr-4 text-right">{comp.sqft.toLocaleString()}</td>
                      <td className="py-2.5 pr-4 text-right">${comp.pricePerSqft}</td>
                      <td className="py-2.5 text-right text-muted-foreground">{comp.date}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/40 rounded">
                    <td className="py-2.5 px-2 font-semibold text-xs" colSpan={2}>AI Avg. Fair Market Value</td>
                    <td className="py-2.5 text-right font-semibold" colSpan={2}>{formatPrice(avgCompPrice)}</td>
                    <td className="py-2.5 text-right text-muted-foreground text-xs">${avgPricePerSqft}/sqft</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-muted/40">
              <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Based on {MOCK_COMPS.length} comparable sales in the Old Northeast neighborhood (St. Petersburg, FL) from the past 90 days, the AI estimates fair market value at <strong>{formatPrice(avgCompPrice)}</strong>.
                Your purchase price of {formatPrice(salePrice)} is {Math.abs(((salePrice - avgCompPrice) / avgCompPrice) * 100).toFixed(1)}% {salePrice > avgCompPrice ? "above" : "below"} the comparable average.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* AI Chat */}
        <Card style={{ borderRadius: "14px" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Ask about the Appraisal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mb-4 max-h-56 overflow-y-auto">
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Ask about the appraisal process, low appraisals, or how to handle an appraisal gap.
                </p>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center ${msg.role === "ai" ? "bg-primary/10" : "bg-muted"}`}>
                    {msg.role === "ai" ? <Bot className="h-4 w-4 text-primary" /> : <User className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div
                    className={`max-w-[80%] p-3 rounded-xl text-sm ${msg.role === "ai" ? "bg-muted" : "text-white"}`}
                    style={msg.role === "user" ? { backgroundColor: "hsl(160, 60%, 28%)" } : {}}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Ask about appraisals, low appraisal options, appraisal gap..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                disabled={sendChat.isPending}
              />
              <Button
                size="icon"
                onClick={handleSendChat}
                disabled={sendChat.isPending || !chatMessage.trim()}
                style={{ backgroundColor: "hsl(160, 60%, 28%)" }}
              >
                {sendChat.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
