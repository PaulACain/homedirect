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
  ArrowLeft, Shield, AlertTriangle, Send, Bot, User,
  Loader2, Building2, CheckCircle2
} from "lucide-react";
import type { Transaction } from "@shared/schema";

type PortalMessage = { id: number; role: string; content: string; createdAt: string };

function formatPrice(p: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(p);
}

function renderMarkdown(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/⚠️/g, "⚠️")
    .replace(/\n/g, "<br/>");
}

const ESCROW_STEPS = [
  "Escrow Opened",
  "Earnest Money Received",
  "Closing Funds Received",
  "Disbursement",
  "Closed",
];

function getEscrowStepIndex(status: string | null | undefined): number {
  if (!status || status === "not_started") return -1;
  if (status === "opened") return 0;
  if (status === "funded") return 2;
  if (status === "disbursed") return 4;
  return 0;
}

export default function PortalEscrow() {
  const [, params] = useRoute("/transaction/:id/escrow");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [chatMessage, setChatMessage] = useState("");

  const txnId = params?.id;

  const { data: txn } = useQuery<Transaction>({
    queryKey: ["/api/transactions", txnId],
    queryFn: () => apiRequest("GET", `/api/transactions/${txnId}`).then((r) => r.json()),
    enabled: !!txnId,
  });

  const { data: messages = [], refetch: refetchMsgs } = useQuery<PortalMessage[]>({
    queryKey: ["/api/transactions", txnId, "portal-messages", "escrow"],
    queryFn: () => apiRequest("GET", `/api/transactions/${txnId}/portal-messages/escrow`).then((r) => r.json()),
    enabled: !!txnId && !!user,
  });

  const sendChat = useMutation({
    mutationFn: (msg: string) =>
      apiRequest("POST", `/api/transactions/${txnId}/portal-chat`, { portal: "escrow", message: msg }).then((r) => r.json()),
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

  const isBuyer = user?.id === txn.buyerId;
  const salePrice = txn.salePrice;
  const earnestMoney = Math.round(salePrice * 0.01);
  const downPayment = Math.round(salePrice * 0.2);
  const platformFee = txn.platformFee;
  const titleInsurance = Math.round(salePrice * 0.005);
  const recordingFees = 500;
  const proratedTaxes = Math.round(salePrice * 0.008);
  const proratedHOA = 150;
  const closingCostsTotal = platformFee + titleInsurance + recordingFees + proratedTaxes + proratedHOA;
  const buyerTotal = downPayment + closingCostsTotal - earnestMoney;
  const sellerNet = salePrice - platformFee - titleInsurance - recordingFees;

  const currentEscrowStep = getEscrowStepIndex(txn.escrowStatus);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6" data-testid="portal-escrow">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation(`/transaction/${txnId}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
            <Shield className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Escrow & Closing</h1>
            <p className="text-xs text-muted-foreground">Wire instructions, closing costs, and documents</p>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {/* Escrow Status */}
        <Card style={{ borderRadius: "14px" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Escrow Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative flex items-center justify-between">
              <div className="absolute top-3.5 left-0 right-0 h-0.5 bg-muted" />
              <div
                className="absolute top-3.5 left-0 h-0.5 bg-primary transition-all"
                style={{
                  backgroundColor: "hsl(160, 60%, 28%)",
                  width: `${Math.max(0, (currentEscrowStep / (ESCROW_STEPS.length - 1)) * 100)}%`,
                }}
              />
              {ESCROW_STEPS.map((step, idx) => (
                <div key={step} className="relative flex flex-col items-center gap-2 z-10">
                  <div
                    className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 border-white ${
                      idx <= currentEscrowStep
                        ? "text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                    style={idx <= currentEscrowStep ? { backgroundColor: "hsl(160, 60%, 28%)" } : {}}
                  >
                    {idx <= currentEscrowStep ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                  </div>
                  <span className={`text-[10px] font-medium text-center max-w-[60px] leading-tight ${idx <= currentEscrowStep ? "text-primary" : "text-muted-foreground"}`}
                    style={idx <= currentEscrowStep ? { color: "hsl(160, 60%, 28%)" } : {}}>
                    {step}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Wire Instructions */}
          <Card style={{ borderRadius: "14px" }}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Wire Instructions
                </CardTitle>
                <Badge variant="outline" className="text-xs">Verify by Phone</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Fraud Warning */}
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-red-700">Wire Fraud Warning</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    Always verify wire instructions by phone before sending money. Wire fraud is the #1 cybercrime in real estate transactions.
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between p-2.5 rounded-lg bg-muted/40">
                  <span className="text-muted-foreground">Bank Name</span>
                  <span className="font-medium">First Title Trust</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-lg bg-muted/40">
                  <span className="text-muted-foreground">Routing Number</span>
                  <span className="font-medium font-mono">••••••1234</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-lg bg-muted/40">
                  <span className="text-muted-foreground">Account Number</span>
                  <span className="font-medium font-mono">••••••5678</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-lg bg-muted/40">
                  <span className="text-muted-foreground">Memo</span>
                  <span className="font-medium">TXN-{txnId} CLOSING</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Contact First Title Trust at (813) 555-0100 to verify instructions before wiring funds.
              </p>
            </CardContent>
          </Card>

          {/* Closing Date */}
          <Card style={{ borderRadius: "14px" }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Closing Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between p-2.5 rounded-lg bg-muted/40">
                <span className="text-muted-foreground">Closing Date</span>
                <span className="font-medium">{txn.closingDate || "TBD"}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-lg bg-muted/40">
                <span className="text-muted-foreground">Time</span>
                <span className="font-medium">10:00 AM</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-lg bg-muted/40">
                <span className="text-muted-foreground">Location</span>
                <span className="font-medium">First Title Trust</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-lg bg-muted/40">
                <span className="text-muted-foreground">Address</span>
                <span className="font-medium text-right">1000 N Tampa St, Tampa, FL 33602</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Closing Cost Breakdown */}
        <Card style={{ borderRadius: "14px" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Closing Cost Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Buyer Side */}
              {isBuyer && (
                <div>
                  <h4 className="text-sm font-semibold mb-3 text-blue-700">Buyer Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">Purchase Price</span>
                      <span className="font-medium">{formatPrice(salePrice)}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">Down Payment (20%)</span>
                      <span className="font-medium">{formatPrice(downPayment)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 text-emerald-600">
                      <span>Earnest Money (credited)</span>
                      <span className="font-medium">−{formatPrice(earnestMoney)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-t">
                      <span className="text-muted-foreground">Platform Fee (1%)</span>
                      <span className="font-medium">{formatPrice(platformFee)}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">Title Insurance</span>
                      <span className="font-medium">{formatPrice(titleInsurance)}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">Recording Fees</span>
                      <span className="font-medium">{formatPrice(recordingFees)}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">Prorated Taxes</span>
                      <span className="font-medium">{formatPrice(proratedTaxes)}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">Prorated HOA</span>
                      <span className="font-medium">{formatPrice(proratedHOA)}</span>
                    </div>
                    <div className="flex justify-between py-2 mt-2 border-t-2 font-semibold">
                      <span>Total Due at Closing</span>
                      <span className="text-primary" style={{ color: "hsl(160, 60%, 28%)" }}>{formatPrice(buyerTotal)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Seller Side */}
              {!isBuyer && (
                <div>
                  <h4 className="text-sm font-semibold mb-3 text-emerald-700">Seller Proceeds</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">Sale Price</span>
                      <span className="font-medium">{formatPrice(salePrice)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 text-red-600">
                      <span>Platform Fee (1%)</span>
                      <span className="font-medium">−{formatPrice(platformFee)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 text-red-600">
                      <span>Title Insurance</span>
                      <span className="font-medium">−{formatPrice(titleInsurance)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 text-red-600">
                      <span>Recording Fees</span>
                      <span className="font-medium">−{formatPrice(recordingFees)}</span>
                    </div>
                    <div className="flex justify-between py-2 mt-2 border-t-2 font-semibold">
                      <span>Estimated Net Proceeds</span>
                      <span style={{ color: "hsl(160, 60%, 28%)" }}>{formatPrice(sellerNet)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Platform Savings Callout */}
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex flex-col justify-center">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">HomeDirectAI Savings</p>
                <p className="text-2xl font-bold" style={{ color: "hsl(160, 60%, 28%)" }}>
                  {formatPrice(salePrice * 0.05)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  vs. traditional 6% agent commission on {formatPrice(salePrice)}
                </p>
                <div className="mt-2 flex gap-2">
                  <div className="flex-1 text-center p-2 rounded-lg bg-red-50 border border-red-100">
                    <p className="text-xs text-muted-foreground">Traditional</p>
                    <p className="text-sm font-semibold text-red-700">{formatPrice(salePrice * 0.06)}</p>
                  </div>
                  <div className="flex-1 text-center p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                    <p className="text-xs text-muted-foreground">HomeDirectAI</p>
                    <p className="text-sm font-semibold text-emerald-700">{formatPrice(platformFee)}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Chat */}
        <Card style={{ borderRadius: "14px" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Ask about Escrow & Closing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mb-4 max-h-56 overflow-y-auto">
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Ask about wire transfers, closing costs, or what to expect at closing.
                </p>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div
                    className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center ${
                      msg.role === "ai" ? "bg-primary/10" : "bg-muted"
                    }`}
                  >
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
                placeholder="Ask about escrow, wires, or closing costs..."
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
