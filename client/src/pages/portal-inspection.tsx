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
  ArrowLeft, Upload, FileText, Loader2, CheckCircle2,
  AlertTriangle, AlertCircle, Info, Send, Search, Bot, User
} from "lucide-react";
import type { Transaction } from "@shared/schema";

type PortalMessage = { id: number; role: string; content: string; createdAt: string };

const MOCK_ANALYSIS = {
  score: "Fair",
  summary: "15 items found — 3 major, 5 moderate, 7 minor",
  major: [
    {
      title: "Roof damage — multiple shingles missing",
      detail: "South-facing slope has 15+ missing shingles, signs of water intrusion in attic",
      cost: "$8,000 – $12,000",
      recommendation: "request_credit",
    },
    {
      title: "Foundation hairline crack — northeast corner",
      detail: "Hairline crack approximately 12 inches. Recommend structural engineer evaluation.",
      cost: "$500 – $15,000",
      recommendation: "request_credit",
    },
    {
      title: "Electrical panel — double-tapped breakers",
      detail: "Main panel shows 4 double-tapped circuit breakers, potential fire hazard",
      cost: "$800 – $2,500",
      recommendation: "request_repair",
    },
  ],
  moderate: [
    {
      title: "HVAC system 17 years old",
      detail: "May need replacement within 2-3 years. Currently functional.",
      cost: "$5,000 – $12,000",
      recommendation: "accept",
    },
    {
      title: "Water heater at end of useful life",
      detail: "Unit is 14 years old, typical lifespan is 10-15 years",
      cost: "$800 – $1,500",
      recommendation: "request_credit",
    },
    {
      title: "Garage door opener inoperative",
      detail: "Neither remote nor wall button functions",
      cost: "$200 – $600",
      recommendation: "request_repair",
    },
    {
      title: "Plumbing — slow drain master bath",
      detail: "Master bathroom tub and shower drain slowly",
      cost: "$150 – $400",
      recommendation: "accept",
    },
    {
      title: "Window seals failed — 3 windows",
      detail: "Condensation between panes in living room and master bedroom",
      cost: "$600 – $1,200",
      recommendation: "request_credit",
    },
  ],
  minor: [
    { title: "Missing outlet covers (6 locations)", cost: "$20", recommendation: "accept" },
    { title: "Caulking around windows needs refresh", cost: "$50", recommendation: "accept" },
    { title: "Bathroom exhaust fan noisy", cost: "$100", recommendation: "accept" },
    { title: "Exterior paint peeling — north side", cost: "$300 – $800", recommendation: "accept" },
    { title: "Gate latch broken — side yard", cost: "$50", recommendation: "accept" },
    { title: "Downspout disconnected from gutter", cost: "$75", recommendation: "accept" },
    { title: "Smoke detector expired — kitchen", cost: "$25", recommendation: "accept" },
  ],
  aiRecommendation: "Based on this report, I recommend requesting a $14,000 seller credit covering the major and key moderate items. The roof ($10,000) and electrical panel ($1,650) are the most urgent. The foundation crack needs a structural engineer evaluation first — if it's cosmetic, reduce the credit request accordingly.",
  creditTotal: "$14,000",
};

const STATUS_STEPS = ["Scheduled", "In Progress", "Report Received", "Review Complete"];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function renderMarkdown(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br/>");
}

function RecommendationBadge({ rec }: { rec: string }) {
  if (rec === "request_credit") return <Badge className="bg-blue-100 text-blue-700 text-xs">Request Credit</Badge>;
  if (rec === "request_repair") return <Badge className="bg-amber-100 text-amber-700 text-xs">Request Repair</Badge>;
  return <Badge variant="outline" className="text-muted-foreground text-xs">Accept As-Is</Badge>;
}

export default function PortalInspection() {
  const [, params] = useRoute("/transaction/:id/inspection");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const txnId = params?.id;

  const { data: txn } = useQuery<Transaction>({
    queryKey: ["/api/transactions", txnId],
    queryFn: () => apiRequest("GET", `/api/transactions/${txnId}`).then((r) => r.json()),
    enabled: !!txnId,
  });

  const { data: messages = [], refetch: refetchMsgs } = useQuery<PortalMessage[]>({
    queryKey: ["/api/transactions", txnId, "portal-messages", "inspection"],
    queryFn: () => apiRequest("GET", `/api/transactions/${txnId}/portal-messages/inspection`).then((r) => r.json()),
    enabled: !!txnId && !!user,
  });

  const { data: docs = [] } = useQuery<any[]>({
    queryKey: ["/api/transactions", txnId, "portal-documents", "inspection"],
    queryFn: () => apiRequest("GET", `/api/transactions/${txnId}/portal-documents?portal=inspection`).then((r) => r.json()),
    enabled: !!txnId && !!user,
  });

  const sendChat = useMutation({
    mutationFn: (msg: string) =>
      apiRequest("POST", `/api/transactions/${txnId}/portal-chat`, { portal: "inspection", message: msg }).then((r) => r.json()),
    onSuccess: () => {
      refetchMsgs();
      setChatMessage("");
    },
    onError: () => toast({ title: "Error", description: "Failed to send message", variant: "destructive" }),
  });

  const handleFileSelect = (file: File) => {
    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      toast({ title: "Invalid file", description: "Please upload a PDF file", variant: "destructive" });
      return;
    }
    setUploadedFile(file.name);
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
      setShowAnalysis(true);
    }, 2500);
  };

  // Check if inspection report was already uploaded
  const existingReport = docs.find((d) => d.type === "inspection_report" && d.status === "uploaded");
  const currentStep = showAnalysis || existingReport ? 3 : uploadedFile ? 2 : txn?.inspectionStatus === "in_progress" ? 1 : 0;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleSendChat = () => {
    const msg = chatMessage.trim();
    if (!msg) return;
    sendChat.mutate(msg);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6" data-testid="portal-inspection">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation(`/transaction/${txnId}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-50 border border-blue-200">
            <Search className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Inspection Portal</h1>
            <p className="text-xs text-muted-foreground">Upload and analyze your home inspection report</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Sidebar */}
        <div className="space-y-4">
          {/* Status Tracker */}
          <Card style={{ borderRadius: "14px" }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Inspection Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {STATUS_STEPS.map((step, idx) => (
                <div key={step} className="flex items-center gap-3">
                  <div
                    className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                      idx <= currentStep
                        ? "bg-primary text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                    style={idx <= currentStep ? { backgroundColor: "hsl(160, 60%, 28%)" } : {}}
                  >
                    {idx < currentStep ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                  </div>
                  <span className={`text-sm ${idx <= currentStep ? "font-medium" : "text-muted-foreground"}`}>
                    {step}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Key Dates */}
          <Card style={{ borderRadius: "14px" }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Key Dates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Inspection Date</span>
                <span className="font-medium">Apr 10, 2026</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Report Due</span>
                <span className="font-medium">Apr 12, 2026</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Review Deadline</span>
                <span className="font-medium text-amber-600">Apr 14, 2026</span>
              </div>
            </CardContent>
          </Card>

          {/* Inspector Info */}
          <Card style={{ borderRadius: "14px" }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Inspector</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p className="font-medium">ProHome Inspections</p>
              <p className="text-muted-foreground">David Martinez, ASHI Certified</p>
              <p className="text-muted-foreground">813-555-7890</p>
              <Badge variant="outline" className="text-xs mt-1">Confirmed</Badge>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Upload Section */}
          {!showAnalysis && !existingReport && (
            <Card style={{ borderRadius: "14px" }}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Upload Inspection Report
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isAnalyzing ? (
                  <div className="text-center py-10">
                    <Loader2 className="h-10 w-10 animate-spin mx-auto mb-3" style={{ color: "hsl(160, 60%, 28%)" }} />
                    <p className="font-medium">AI Analyzing Report...</p>
                    <p className="text-sm text-muted-foreground mt-1">Identifying issues and generating recommendations</p>
                  </div>
                ) : uploadedFile ? (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200">
                    <FileText className="h-6 w-6 text-blue-600" />
                    <div>
                      <p className="font-medium text-sm">{uploadedFile}</p>
                      <p className="text-xs text-muted-foreground">Uploaded — processing</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div
                      className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
                        isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                      }`}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                      <p className="font-medium mb-1">Drag & drop your inspection report</p>
                      <p className="text-sm text-muted-foreground">PDF files only · Max 10MB</p>
                      <Button variant="outline" size="sm" className="mt-4" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                        Browse Files
                      </Button>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,application/pdf"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* AI Analysis (shown after upload or if existing report) */}
          {(showAnalysis || existingReport) && (
            <div className="space-y-4">
              {/* Existing Report Notice */}
              {existingReport && !showAnalysis && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200">
                  <FileText className="h-6 w-6 text-blue-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Inspection Report Uploaded</p>
                    <p className="text-xs text-muted-foreground">{existingReport.name}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAnalysis(true)}
                  >
                    View Analysis
                  </Button>
                </div>
              )}

              {/* Overall Score */}
              <Card style={{ borderRadius: "14px" }} className="border-amber-200 bg-amber-50/50">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">AI Analysis Complete</h3>
                    <Badge className="bg-amber-100 text-amber-700 text-sm px-3">
                      Condition: {MOCK_ANALYSIS.score}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{MOCK_ANALYSIS.summary}</p>
                </CardContent>
              </Card>

              {/* Major Issues */}
              <Card style={{ borderRadius: "14px" }}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    Major Issues
                    <Badge className="bg-red-100 text-red-700 text-xs">{MOCK_ANALYSIS.major.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {MOCK_ANALYSIS.major.map((item, i) => (
                    <div key={i} className="p-3 rounded-xl bg-red-50 border border-red-200">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-medium text-sm">{item.title}</p>
                        <RecommendationBadge rec={item.recommendation} />
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">{item.detail}</p>
                      <p className="text-xs font-medium text-red-700">Est. cost: {item.cost}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Moderate Issues */}
              <Card style={{ borderRadius: "14px" }}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    Moderate Issues
                    <Badge className="bg-amber-100 text-amber-700 text-xs">{MOCK_ANALYSIS.moderate.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {MOCK_ANALYSIS.moderate.map((item, i) => (
                    <div key={i} className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-medium text-sm">{item.title}</p>
                        <RecommendationBadge rec={item.recommendation} />
                      </div>
                      <p className="text-xs font-medium text-amber-700">Est. cost: {item.cost}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Minor Issues */}
              <Card style={{ borderRadius: "14px" }}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    Minor Issues
                    <Badge variant="outline" className="text-xs">{MOCK_ANALYSIS.minor.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {MOCK_ANALYSIS.minor.map((item, i) => (
                      <div key={i} className="p-2.5 rounded-lg bg-muted/40 border">
                        <p className="text-xs font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.cost}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* AI Recommendations Panel */}
              <Card style={{ borderRadius: "14px" }} className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" />
                    AI Recommendation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm">{MOCK_ANALYSIS.aiRecommendation}</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 p-3 rounded-xl bg-primary text-white text-center">
                      <p className="text-xs opacity-80">Recommended Seller Credit</p>
                      <p className="text-xl font-bold">{MOCK_ANALYSIS.creditTotal}</p>
                    </div>
                    <Button
                      className="flex-shrink-0"
                      style={{ backgroundColor: "hsl(160, 60%, 28%)" }}
                      onClick={() => {
                        sendChat.mutate("Please draft a repair request / credit request based on the inspection findings");
                      }}
                    >
                      Draft Repair Request
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* AI Chat */}
          <Card style={{ borderRadius: "14px" }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Ask the AI about this inspection
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Message History */}
              <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                {messages.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Ask about any finding — "Is the foundation crack serious?" or "Should I walk away?"
                  </p>
                )}
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div
                      className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center ${
                        msg.role === "ai" ? "bg-primary/10" : "bg-muted"
                      }`}
                    >
                      {msg.role === "ai" ? (
                        <Bot className="h-4 w-4 text-primary" />
                      ) : (
                        <User className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div
                      className={`max-w-[80%] p-3 rounded-xl text-sm ${
                        msg.role === "ai"
                          ? "bg-muted"
                          : "text-white"
                      }`}
                      style={msg.role === "user" ? { backgroundColor: "hsl(160, 60%, 28%)" } : {}}
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                    />
                  </div>
                ))}
              </div>

              {/* Input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Ask about the inspection findings..."
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
    </div>
  );
}
