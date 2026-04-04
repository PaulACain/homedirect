import { useState, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, FileText, CheckCircle2, Upload, Send, Bot, User,
  Loader2, Phone, Mail, Building2, MessageSquare, Clock
} from "lucide-react";
import type { Transaction } from "@shared/schema";

type PortalMessage = { id: number; role: string; content: string; createdAt: string };

function renderMarkdown(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br/>");
}

const TITLE_STEPS = ["Ordered", "In Progress", "Preliminary Report", "Clear to Close"];

function getTitleStep(status: string | null | undefined): number {
  if (!status || status === "not_started") return -1;
  if (status === "ordered") return 0;
  if (status === "in_progress") return 1;
  if (status === "clear") return 3;
  if (status === "issues") return 2;
  return 0;
}

const TITLE_DOCS = [
  { key: "id_document", name: "Government ID (Driver's License or Passport)", required: "both", portal: "title" },
  { key: "insurance", name: "Proof of Homeowner's Insurance", required: "buyer", portal: "title" },
  { key: "hoa_docs", name: "HOA Documents", required: "seller", portal: "title" },
  { key: "survey", name: "Property Survey", required: "seller", portal: "title" },
];

// Simulated title company messages
const TITLE_COMPANY_MSGS = [
  {
    from: "Title Company",
    content: "Welcome! We've received your purchase agreement and have begun the title search. Expected completion: 5-7 business days.",
    time: "Apr 5, 10:23 AM",
    fromUs: false,
  },
  {
    from: "You",
    content: "Great, thank you! Should I schedule the survey now or wait?",
    time: "Apr 5, 11:05 AM",
    fromUs: true,
  },
  {
    from: "Title Company",
    content: "We'll need the survey ordered within the next week. I'll send the list of approved surveyors by end of day.",
    time: "Apr 5, 11:42 AM",
    fromUs: false,
  },
];

export default function PortalTitle() {
  const [, params] = useRoute("/transaction/:id/title");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [chatMessage, setChatMessage] = useState("");
  const [titleCompanyMsg, setTitleCompanyMsg] = useState("");
  const [localMsgs, setLocalMsgs] = useState(TITLE_COMPANY_MSGS);

  const txnId = params?.id;

  const { data: txn } = useQuery<Transaction>({
    queryKey: ["/api/transactions", txnId],
    queryFn: () => apiRequest("GET", `/api/transactions/${txnId}`).then((r) => r.json()),
    enabled: !!txnId,
  });

  const { data: messages = [], refetch: refetchMsgs } = useQuery<PortalMessage[]>({
    queryKey: ["/api/transactions", txnId, "portal-messages", "title"],
    queryFn: () => apiRequest("GET", `/api/transactions/${txnId}/portal-messages/title`).then((r) => r.json()),
    enabled: !!txnId && !!user,
  });

  const { data: docs = [], refetch: refetchDocs } = useQuery<any[]>({
    queryKey: ["/api/transactions", txnId, "portal-documents", "title"],
    queryFn: () => apiRequest("GET", `/api/transactions/${txnId}/portal-documents?portal=title`).then((r) => r.json()),
    enabled: !!txnId && !!user,
  });

  const sendChat = useMutation({
    mutationFn: (msg: string) =>
      apiRequest("POST", `/api/transactions/${txnId}/portal-chat`, { portal: "title", message: msg }).then((r) => r.json()),
    onSuccess: () => { refetchMsgs(); setChatMessage(""); },
    onError: () => toast({ title: "Error", description: "Failed to send message", variant: "destructive" }),
  });

  const uploadDoc = useMutation({
    mutationFn: ({ name, type, documentId }: { name: string; type: string; documentId?: number }) =>
      apiRequest("POST", `/api/transactions/${txnId}/documents/upload`, { portal: "title", name, type, documentId }).then((r) => r.json()),
    onSuccess: () => { refetchDocs(); toast({ title: "Document uploaded", description: "Document is now under review." }); },
    onError: () => toast({ title: "Error", description: "Failed to upload document", variant: "destructive" }),
  });

  const handleSendChat = () => {
    const msg = chatMessage.trim();
    if (!msg) return;
    sendChat.mutate(msg);
  };

  const handleSendTitleMsg = () => {
    const msg = titleCompanyMsg.trim();
    if (!msg) return;
    setLocalMsgs([...localMsgs, { from: "You", content: msg, time: new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }), fromUs: true }]);
    setTitleCompanyMsg("");
    // Simulate response
    setTimeout(() => {
      setLocalMsgs(prev => [...prev, {
        from: "Title Company",
        content: "Thank you for reaching out. A member of our team will follow up shortly. For urgent matters, please call (813) 555-0100.",
        time: new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
        fromUs: false,
      }]);
    }, 1500);
  };

  const handleFileUpload = (docType: string, docName: string) => {
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

  const isBuyer = user?.id === txn.buyerId;
  const currentStep = getTitleStep(txn.titleStatus);

  // Filter relevant docs based on role
  const relevantDocs = TITLE_DOCS.filter((d) => d.required === "both" || (isBuyer ? d.required === "buyer" : d.required === "seller"));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6" data-testid="portal-title">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation(`/transaction/${txnId}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-rose-50 border border-rose-200">
            <FileText className="h-5 w-5 text-rose-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Title Company Portal</h1>
            <p className="text-xs text-muted-foreground">Document requests, title search, and company communications</p>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {/* Status Tracker */}
        <Card style={{ borderRadius: "14px" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Title Search Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative flex items-center justify-between">
              <div className="absolute top-3.5 left-0 right-0 h-0.5 bg-muted" />
              <div
                className="absolute top-3.5 left-0 h-0.5 transition-all"
                style={{
                  backgroundColor: "hsl(160, 60%, 28%)",
                  width: `${Math.max(0, ((currentStep) / (TITLE_STEPS.length - 1)) * 100)}%`,
                }}
              />
              {TITLE_STEPS.map((step, idx) => (
                <div key={step} className="relative flex flex-col items-center gap-2 z-10">
                  <div
                    className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 border-white ${
                      idx <= currentStep ? "text-white" : "bg-muted text-muted-foreground"
                    }`}
                    style={idx <= currentStep ? { backgroundColor: "hsl(160, 60%, 28%)" } : {}}
                  >
                    {idx < currentStep ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                  </div>
                  <span
                    className={`text-[10px] font-medium text-center max-w-[70px] leading-tight ${idx <= currentStep ? "text-primary" : "text-muted-foreground"}`}
                    style={idx <= currentStep ? { color: "hsl(160, 60%, 28%)" } : {}}
                  >
                    {step}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Title Company Info */}
          <Card style={{ borderRadius: "14px" }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Title Company
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="font-semibold">First Title Trust of Florida</p>
                <p className="text-sm text-muted-foreground">Licensed Title & Escrow Company</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>(813) 555-0100</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>closing@firsttitletrust.com</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>1000 N Tampa St, Tampa, FL 33602</span>
                </div>
              </div>
              <div className="pt-1">
                <p className="text-xs text-muted-foreground mb-1">Your closing officer</p>
                <p className="text-sm font-medium">Maria Gonzalez</p>
                <p className="text-xs text-muted-foreground">mgonzalez@firsttitletrust.com</p>
              </div>
            </CardContent>
          </Card>

          {/* Title Issues */}
          <Card style={{ borderRadius: "14px" }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Title Issues</CardTitle>
            </CardHeader>
            <CardContent>
              {txn.titleStatus === "issues" ? (
                <div className="space-y-2">
                  <div className="p-3 rounded-xl border border-amber-200 bg-amber-50">
                    <p className="text-sm font-medium text-amber-800">HOA Lien — $450</p>
                    <p className="text-xs text-amber-700 mt-0.5">Unpaid HOA dues from prior owner. Must be cleared before closing.</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The title company will coordinate with the seller to clear this lien before closing.
                  </p>
                </div>
              ) : txn.titleStatus === "clear" ? (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <p className="text-sm text-emerald-700 font-medium">Title is clear — no issues found</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/40">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Title search in progress. Results within 5-7 business days.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Document Requests */}
        <Card style={{ borderRadius: "14px" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Document Requests from Title Company</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {relevantDocs.map((reqDoc) => {
                const uploaded = docs.find((d) => d.type === reqDoc.key);
                const status = uploaded?.status || "requested";

                return (
                  <div
                    key={reqDoc.key}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                      status === "uploaded" || status === "approved"
                        ? "border-emerald-200 bg-emerald-50/50"
                        : "border-border"
                    }`}
                  >
                    <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${status === "uploaded" || status === "approved" ? "bg-emerald-100" : "bg-muted"}`}>
                      {status === "approved" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : status === "uploaded" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{reqDoc.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {status === "approved" && <Badge className="bg-emerald-100 text-emerald-700 text-xs">Approved</Badge>}
                        {status === "uploaded" && <Badge className="bg-blue-100 text-blue-700 text-xs">Uploaded — Under Review</Badge>}
                        {status === "requested" && <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">Requested</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {status === "requested" ? (
                        <>
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
                            onChange={() => handleFileUpload(reqDoc.key, reqDoc.name)}
                          />
                        </>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                          {status === "uploaded" ? "Submitted" : "Done"}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Chat with Title Company (Simulated) */}
        <Card style={{ borderRadius: "14px" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Message Title Company
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mb-4 max-h-52 overflow-y-auto">
              {localMsgs.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.fromUs ? "flex-row-reverse" : ""}`}>
                  <div className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold ${msg.fromUs ? "bg-muted" : "bg-rose-100"}`}>
                    {msg.fromUs ? "Me" : "TT"}
                  </div>
                  <div className="max-w-[80%]">
                    <div
                      className={`p-3 rounded-xl text-sm ${msg.fromUs ? "text-white" : "bg-muted"}`}
                      style={msg.fromUs ? { backgroundColor: "hsl(160, 60%, 28%)" } : {}}
                    >
                      {msg.content}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 px-1">{msg.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Message the title company..."
                value={titleCompanyMsg}
                onChange={(e) => setTitleCompanyMsg(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendTitleMsg(); } }}
              />
              <Button
                size="icon"
                onClick={handleSendTitleMsg}
                disabled={!titleCompanyMsg.trim()}
                style={{ backgroundColor: "hsl(160, 60%, 28%)" }}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* AI Chat */}
        <Card style={{ borderRadius: "14px" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Ask the AI about Title & Closing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Ask about title insurance, liens, easements, or what happens at closing.
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
                placeholder="Ask about title insurance, liens, easements..."
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
