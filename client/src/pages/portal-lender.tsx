import { useState, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Building2, CheckCircle2, Upload, Send, Bot, User,
  Loader2, FileText, Circle, Clock
} from "lucide-react";
import type { Transaction } from "@shared/schema";

type PortalMessage = { id: number; role: string; content: string; createdAt: string };

function formatPrice(p: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(p);
}

function calcMonthlyPayment(principal: number, annualRate: number, years: number): number {
  const r = annualRate / 12;
  const n = years * 12;
  return Math.round((principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
}

function renderMarkdown(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br/>");
}

const MORTGAGE_STEPS = [
  "Pre-Qualification",
  "Pre-Approval",
  "Full Application",
  "Underwriting",
  "Clear to Close",
];

const REQUIRED_DOCS = [
  { key: "pay_stub", name: "Pay Stubs (Last 2 Months)", description: "Most recent 2 months" },
  { key: "w2", name: "W-2s (Last 2 Years)", description: "2024 and 2023" },
  { key: "tax_returns", name: "Tax Returns (Last 2 Years)", description: "Federal 1040 with all schedules" },
  { key: "bank_statements", name: "Bank Statements (Last 2 Months)", description: "All pages, all accounts" },
  { key: "employment_letter", name: "Employment Verification Letter", description: "From HR or supervisor" },
  { key: "gift_letter", name: "Gift Letter (if applicable)", description: "If using gift funds for down payment" },
];

export default function PortalLender() {
  const [, params] = useRoute("/transaction/:id/lender");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [chatMessage, setChatMessage] = useState("");
  const [showAddLender, setShowAddLender] = useState(false);
  const [lenderForm, setLenderForm] = useState({ name: "", officer: "", phone: "", email: "" });

  const txnId = params?.id;

  const { data: txn } = useQuery<Transaction>({
    queryKey: ["/api/transactions", txnId],
    queryFn: () => apiRequest("GET", `/api/transactions/${txnId}`).then((r) => r.json()),
    enabled: !!txnId,
  });

  const { data: messages = [], refetch: refetchMsgs } = useQuery<PortalMessage[]>({
    queryKey: ["/api/transactions", txnId, "portal-messages", "lender"],
    queryFn: () => apiRequest("GET", `/api/transactions/${txnId}/portal-messages/lender`).then((r) => r.json()),
    enabled: !!txnId && !!user,
  });

  const { data: docs = [], refetch: refetchDocs } = useQuery<any[]>({
    queryKey: ["/api/transactions", txnId, "portal-documents", "lender"],
    queryFn: () => apiRequest("GET", `/api/transactions/${txnId}/portal-documents?portal=lender`).then((r) => r.json()),
    enabled: !!txnId && !!user,
  });

  const sendChat = useMutation({
    mutationFn: (msg: string) =>
      apiRequest("POST", `/api/transactions/${txnId}/portal-chat`, { portal: "lender", message: msg }).then((r) => r.json()),
    onSuccess: () => { refetchMsgs(); setChatMessage(""); },
    onError: () => toast({ title: "Error", description: "Failed to send message", variant: "destructive" }),
  });

  const uploadDoc = useMutation({
    mutationFn: ({ name, type, documentId }: { name: string; type: string; documentId?: number }) =>
      apiRequest("POST", `/api/transactions/${txnId}/documents/upload`, { portal: "lender", name, type, documentId }).then((r) => r.json()),
    onSuccess: () => { refetchDocs(); },
    onError: () => toast({ title: "Error", description: "Failed to upload document", variant: "destructive" }),
  });

  const handleSendChat = () => {
    const msg = chatMessage.trim();
    if (!msg) return;
    sendChat.mutate(msg);
  };

  const handleFileUpload = (docType: string, docName: string, file: File) => {
    const existing = docs.find((d) => d.type === docType);
    uploadDoc.mutate({ name: docName, type: docType, documentId: existing?.id });
  };

  if (!txn) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const salePrice = txn.salePrice;
  const downPayment = Math.round(salePrice * 0.2);
  const loanAmount = salePrice - downPayment;
  const rate30 = 0.0695;
  const rate15 = 0.0625;
  const monthly30 = calcMonthlyPayment(loanAmount, rate30, 30);
  const monthly15 = calcMonthlyPayment(loanAmount, rate15, 15);
  const taxes = Math.round(salePrice * 0.015 / 12);
  const insurance = Math.round(salePrice * 0.005 / 12);

  // Determine mortgage step (based on whether docs are uploaded)
  const uploadedCount = docs.filter((d) => d.status === "uploaded").length;
  const mortgageStep = uploadedCount >= 2 ? 2 : uploadedCount >= 1 ? 1 : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6" data-testid="portal-lender">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation(`/transaction/${txnId}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-purple-50 border border-purple-200">
            <Building2 className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Lender Portal</h1>
            <p className="text-xs text-muted-foreground">Mortgage status, documents, and loan summary</p>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {/* Mortgage Status Tracker */}
        <Card style={{ borderRadius: "14px" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Mortgage Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative flex items-center justify-between">
              <div className="absolute top-3.5 left-0 right-0 h-0.5 bg-muted" />
              <div
                className="absolute top-3.5 left-0 h-0.5 transition-all"
                style={{
                  backgroundColor: "hsl(160, 60%, 28%)",
                  width: `${Math.max(0, (mortgageStep / (MORTGAGE_STEPS.length - 1)) * 100)}%`,
                }}
              />
              {MORTGAGE_STEPS.map((step, idx) => (
                <div key={step} className="relative flex flex-col items-center gap-2 z-10">
                  <div
                    className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 border-white ${
                      idx <= mortgageStep ? "text-white" : "bg-muted text-muted-foreground"
                    }`}
                    style={idx <= mortgageStep ? { backgroundColor: "hsl(160, 60%, 28%)" } : {}}
                  >
                    {idx < mortgageStep ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                  </div>
                  <span
                    className={`text-[10px] font-medium text-center max-w-[60px] leading-tight ${idx <= mortgageStep ? "text-primary" : "text-muted-foreground"}`}
                    style={idx <= mortgageStep ? { color: "hsl(160, 60%, 28%)" } : {}}
                  >
                    {step}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Lender Information */}
          <Card style={{ borderRadius: "14px" }}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Lender Information</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setShowAddLender(!showAddLender)}>
                  {showAddLender ? "Cancel" : "Add Lender"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {showAddLender ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Lender / Bank Name</Label>
                    <Input placeholder="e.g., Wells Fargo" value={lenderForm.name} onChange={(e) => setLenderForm({ ...lenderForm, name: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Loan Officer Name</Label>
                    <Input placeholder="Full name" value={lenderForm.officer} onChange={(e) => setLenderForm({ ...lenderForm, officer: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Phone</Label>
                    <Input placeholder="(813) 555-0000" value={lenderForm.phone} onChange={(e) => setLenderForm({ ...lenderForm, phone: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input placeholder="email@lender.com" value={lenderForm.email} onChange={(e) => setLenderForm({ ...lenderForm, email: e.target.value })} />
                  </div>
                  <Button
                    className="w-full"
                    size="sm"
                    style={{ backgroundColor: "hsl(160, 60%, 28%)" }}
                    onClick={() => {
                      apiRequest("PATCH", `/api/transactions/${txnId}/lender`, lenderForm);
                      setShowAddLender(false);
                      toast({ title: "Lender info saved" });
                    }}
                  >
                    Save Lender Info
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between p-2.5 rounded-lg bg-muted/40">
                    <span className="text-muted-foreground">Lender</span>
                    <span className="font-medium">Metro Bank Mortgage</span>
                  </div>
                  <div className="flex justify-between p-2.5 rounded-lg bg-muted/40">
                    <span className="text-muted-foreground">Loan Officer</span>
                    <span className="font-medium">Jennifer Walsh</span>
                  </div>
                  <div className="flex justify-between p-2.5 rounded-lg bg-muted/40">
                    <span className="text-muted-foreground">Phone</span>
                    <span className="font-medium">(813) 555-2200</span>
                  </div>
                  <div className="flex justify-between p-2.5 rounded-lg bg-muted/40">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium">jwalsh@metrobank.com</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Loan Summary */}
          <Card style={{ borderRadius: "14px" }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Loan Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between p-2.5 rounded-lg bg-muted/40">
                  <span className="text-muted-foreground">Purchase Price</span>
                  <span className="font-medium">{formatPrice(salePrice)}</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-lg bg-muted/40">
                  <span className="text-muted-foreground">Down Payment (20%)</span>
                  <span className="font-medium">{formatPrice(downPayment)}</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-lg bg-muted/40">
                  <span className="text-muted-foreground">Loan Amount</span>
                  <span className="font-semibold">{formatPrice(loanAmount)}</span>
                </div>
              </div>

              {/* 30 vs 15 year */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="p-3 rounded-xl border-2 border-primary" style={{ borderColor: "hsl(160, 60%, 28%)" }}>
                  <p className="text-xs text-muted-foreground">30-Year Fixed</p>
                  <p className="text-sm font-semibold">{(rate30 * 100).toFixed(2)}% rate</p>
                  <p className="text-lg font-bold" style={{ color: "hsl(160, 60%, 28%)" }}>{formatPrice(monthly30)}/mo</p>
                  <p className="text-xs text-muted-foreground mt-1">P&I only</p>
                </div>
                <div className="p-3 rounded-xl border border-muted">
                  <p className="text-xs text-muted-foreground">15-Year Fixed</p>
                  <p className="text-sm font-semibold">{(rate15 * 100).toFixed(2)}% rate</p>
                  <p className="text-lg font-bold">{formatPrice(monthly15)}/mo</p>
                  <p className="text-xs text-muted-foreground mt-1">P&I only</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-muted/40 text-sm">
                <p className="text-muted-foreground text-xs mb-2">Total Monthly Payment Estimate (30yr)</p>
                <div className="space-y-1">
                  <div className="flex justify-between"><span>Principal & Interest</span><span>{formatPrice(monthly30)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Property Taxes</span><span>{formatPrice(taxes)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Homeowner's Insurance</span><span>{formatPrice(insurance)}</span></div>
                  <div className="flex justify-between font-semibold border-t pt-1 mt-1"><span>Total</span><span>{formatPrice(monthly30 + taxes + insurance)}</span></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Required Documents */}
        <Card style={{ borderRadius: "14px" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Required Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {REQUIRED_DOCS.map((reqDoc) => {
                const uploaded = docs.find((d) => d.type === reqDoc.key && d.status === "uploaded");
                return (
                  <div
                    key={reqDoc.key}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                      uploaded ? "border-emerald-200 bg-emerald-50/50" : "border-border"
                    }`}
                  >
                    <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${uploaded ? "bg-emerald-100" : "bg-muted"}`}>
                      {uploaded ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{reqDoc.name}</p>
                      <p className="text-xs text-muted-foreground">{reqDoc.description}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {uploaded ? (
                        <Badge className="bg-emerald-100 text-emerald-700 text-xs">Uploaded</Badge>
                      ) : (
                        <>
                          <Badge variant="outline" className="text-xs">Required</Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => fileRefs.current[reqDoc.key]?.click()}
                            disabled={uploadDoc.isPending}
                          >
                            <Upload className="h-3 w-3 mr-1" />
                            Upload
                          </Button>
                          <input
                            ref={(el) => { fileRefs.current[reqDoc.key] = el; }}
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleFileUpload(reqDoc.key, reqDoc.name, f);
                            }}
                          />
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* AI Chat */}
        <Card style={{ borderRadius: "14px" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Ask about Mortgages & Lending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mb-4 max-h-56 overflow-y-auto">
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Ask about mortgage rates, PMI, DTI ratios, or loan types.
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
                placeholder="Ask about mortgage rates, PMI, loan types..."
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
