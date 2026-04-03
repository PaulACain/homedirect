import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import {
  DollarSign, MapPin, Clock, Star, CheckCircle2, Briefcase, TrendingUp,
  Home, Calendar, Loader2, AlertCircle, UserCheck,
} from "lucide-react";
import type { ChaperonePayout } from "@shared/schema";
import { Link } from "wouter";

type GigWithListing = {
  id: number;
  listingId: number;
  buyerId: number;
  chaperoneId: number | null;
  scheduledDate: string;
  scheduledTime: string;
  status: string;
  chaperonePayment: number;
  buyerNotes: string | null;
  chaperoneNotes: string | null;
  createdAt: string;
  listing: {
    id: number;
    address: string;
    city: string;
    state: string;
    zip: string;
    images: string;
    price: number;
    bedrooms: number;
    bathrooms: number;
    sqft: number;
  } | null;
};

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    requested: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    assigned: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    processing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    earning: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    payout: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${variants[status] || "bg-muted text-muted-foreground"}`}>
      {status}
    </span>
  );
}

function GigCard({
  gig, onAccept, onPass, onComplete, isAccepting, isCompleting, mode,
}: {
  gig: GigWithListing;
  onAccept?: () => void;
  onPass?: () => void;
  onComplete?: () => void;
  isAccepting?: boolean;
  isCompleting?: boolean;
  mode: "available" | "my-gigs";
}) {
  const listing = gig.listing;
  const images = listing?.images ? (() => { try { return JSON.parse(listing.images); } catch { return []; } })() : [];
  const photo = images[0] || "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400";

  return (
    <Card className="overflow-hidden" data-testid={`card-gig-${gig.id}`}>
      <div className="flex">
        <div className="w-24 h-24 flex-shrink-0 overflow-hidden sm:w-32 sm:h-32">
          <img src={photo} alt="Property" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 p-3 sm:p-4 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-medium truncate">
                {mode === "available" && (
                  <span className="relative flex h-2 w-2 flex-shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                )}
                <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{listing?.address || "Unknown address"}</span>
              </div>
              <p className="text-xs text-muted-foreground">{listing?.city}, {listing?.state} {listing?.zip}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-xs font-semibold whitespace-nowrap" data-testid={`badge-payment-${gig.id}`}>
                ${gig.chaperonePayment.toFixed(2)}
              </Badge>
              <StatusBadge status={gig.status} />
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {gig.scheduledDate}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {gig.scheduledTime}
            </span>
          </div>

          {gig.buyerNotes && (
            <p className="mt-1.5 text-xs text-muted-foreground line-clamp-1 italic">"{gig.buyerNotes}"</p>
          )}

          {mode === "available" && (
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                className="h-7 text-xs bg-primary hover:bg-primary/90"
                onClick={onAccept}
                disabled={isAccepting}
                data-testid={`button-accept-gig-${gig.id}`}
              >
                {isAccepting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Accept Gig
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={onPass}
                data-testid={`button-pass-gig-${gig.id}`}
              >
                Pass
              </Button>
            </div>
          )}

          {mode === "my-gigs" && gig.status === "assigned" && (
            <div className="mt-3">
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={onComplete}
                disabled={isCompleting}
                data-testid={`button-complete-gig-${gig.id}`}
              >
                {isCompleting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                Mark Complete
              </Button>
            </div>
          )}

          {mode === "my-gigs" && gig.status === "completed" && (
            <div className="mt-2">
              <span className="text-xs font-medium text-green-600 dark:text-green-400">$20 earned</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function ChaperoneDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [passedGigIds, setPassedGigIds] = useState<number[]>([]);

  // Fetch chaperone application to get bank info
  const { data: chaperoneApp } = useQuery<any>({
    queryKey: ["/api/chaperone/application", user?.id],
    queryFn: () => user ? apiRequest("GET", `/api/chaperone/application/${user.id}`).then(r => r.json()) : null,
    enabled: !!user,
  });

  // Available gigs
  const { data: availableGigs = [], isLoading: gigsLoading, refetch: refetchGigs } = useQuery<GigWithListing[]>({
    queryKey: ["/api/chaperone/available-gigs", user?.id],
    queryFn: () => user ? apiRequest("GET", `/api/chaperone/available-gigs/${user.id}`).then(r => r.json()) : [],
    enabled: !!user,
    refetchInterval: 30000,
  });

  // My gigs
  const { data: myGigs = [], isLoading: myGigsLoading, refetch: refetchMyGigs } = useQuery<GigWithListing[]>({
    queryKey: ["/api/chaperone/my-gigs", user?.id],
    queryFn: () => user ? apiRequest("GET", `/api/chaperone/my-gigs/${user.id}`).then(r => r.json()) : [],
    enabled: !!user,
  });

  // Earnings
  const { data: earningsData, isLoading: earningsLoading, refetch: refetchEarnings } = useQuery<{
    total: number; pending: number; paid: number; payouts: ChaperonePayout[];
  }>({
    queryKey: ["/api/chaperone/earnings", user?.id],
    queryFn: () => user ? apiRequest("GET", `/api/chaperone/earnings/${user.id}`).then(r => r.json()) : null,
    enabled: !!user,
  });

  const acceptMutation = useMutation({
    mutationFn: (walkthroughId: number) =>
      apiRequest("POST", `/api/chaperone/accept-gig/${walkthroughId}`, { chaperoneId: user!.id }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Gig accepted!", description: "Check My Gigs tab for details." });
      refetchGigs();
      refetchMyGigs();
      refetchEarnings();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const completeMutation = useMutation({
    mutationFn: (walkthroughId: number) =>
      apiRequest("POST", `/api/chaperone/complete-gig/${walkthroughId}`, {}).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Showing completed!", description: "$20 earned and added to your balance." });
      refetchMyGigs();
      refetchEarnings();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const payoutMutation = useMutation({
    mutationFn: (amount: number) =>
      apiRequest("POST", "/api/chaperone/request-payout", {
        chaperoneId: user!.id,
        amount,
        bankLast4: chaperoneApp?.bankAccountNumber?.slice(-4) || "0000",
      }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Payout requested!", description: "Transfer will arrive within 1-2 business days." });
      setPayoutDialogOpen(false);
      setPayoutAmount("");
      refetchEarnings();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handlePass = async (walkthroughId: number) => {
    await apiRequest("POST", `/api/chaperone/decline-gig/${walkthroughId}`, {}).then(r => r.json());
    setPassedGigIds(ids => [...ids, walkthroughId]);
    refetchGigs();
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center px-4">
        <UserCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
        <h2 className="mb-1 text-lg font-semibold">Sign in to access your dashboard</h2>
        <p className="text-sm text-muted-foreground">You must be signed in as a chaperone.</p>
      </div>
    );
  }

  // Allow access if user role is chaperone OR if they have an approved chaperone application
  const isApprovedChaperone = user.role === "chaperone" || chaperoneApp?.status === "approved";

  if (!isApprovedChaperone && chaperoneApp !== undefined) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center px-4" data-testid="not-chaperone-notice">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
        <h2 className="mb-1 text-lg font-semibold">Not a chaperone yet</h2>
        <p className="mb-4 text-sm text-muted-foreground">Apply to become a HomeDirectAI chaperone to access this dashboard.</p>
        <Link href="/chaperone-apply">
          <Button data-testid="button-apply-chaperone">Apply Now</Button>
        </Link>
      </div>
    );
  }

  // Compute stats
  const payouts = earningsData?.payouts || [];
  const completedEarnings = payouts.filter(p => p.type === "earning" && p.status === "completed").reduce((s, p) => s + p.amount, 0);
  const withdrawals = Math.abs(payouts.filter(p => p.type === "payout").reduce((s, p) => s + p.amount, 0));
  const availableBalance = completedEarnings - withdrawals;
  const completedShowings = myGigs.filter(g => g.status === "completed").length;

  const visibleAvailableGigs = availableGigs.filter(g => !passedGigIds.includes(g.id));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8" data-testid="page-chaperone-dashboard">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Chaperone Dashboard</h1>
          <p className="text-sm text-muted-foreground">Welcome back, {user.fullName?.split(" ")[0]}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-primary" />
          <span className="text-xs text-muted-foreground">Active</span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Total Earnings",
            value: earningsLoading ? "—" : `$${completedEarnings.toFixed(2)}`,
            icon: TrendingUp,
            desc: "All time",
          },
          {
            label: "Available Balance",
            value: earningsLoading ? "—" : `$${availableBalance.toFixed(2)}`,
            icon: DollarSign,
            desc: "Ready to withdraw",
          },
          {
            label: "Completed Showings",
            value: myGigsLoading ? "—" : completedShowings.toString(),
            icon: Home,
            desc: "All time",
          },
          {
            label: "Rating",
            value: "4.8",
            icon: Star,
            desc: "Out of 5.0",
          },
        ].map((stat) => (
          <Card key={stat.label} className="p-4" data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="mt-1 text-xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.desc}</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-2">
                <stat.icon className="h-4 w-4 text-primary" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="available" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="available" data-testid="tab-available-gigs">
            Available Gigs
            {visibleAvailableGigs.length > 0 && (
              <span className="ml-1.5 rounded-full bg-primary text-primary-foreground px-1.5 py-0 text-xs">{visibleAvailableGigs.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="my-gigs" data-testid="tab-my-gigs">My Gigs</TabsTrigger>
          <TabsTrigger value="earnings" data-testid="tab-earnings">Earnings</TabsTrigger>
        </TabsList>

        {/* Available Gigs Tab */}
        <TabsContent value="available" className="space-y-3">
          {gigsLoading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <Card key={i} className="p-4">
                <div className="flex gap-3">
                  <Skeleton className="h-20 w-20 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              </Card>
            ))
          ) : visibleAvailableGigs.length === 0 ? (
            <Card className="p-8 text-center" data-testid="empty-available-gigs">
              <Briefcase className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium">No available gigs right now</p>
              <p className="text-xs text-muted-foreground mt-1">Check back soon — new showing requests come in daily.</p>
            </Card>
          ) : (
            visibleAvailableGigs.map(gig => (
              <GigCard
                key={gig.id}
                gig={gig}
                mode="available"
                onAccept={() => acceptMutation.mutate(gig.id)}
                onPass={() => handlePass(gig.id)}
                isAccepting={acceptMutation.isPending && acceptMutation.variables === gig.id}
              />
            ))
          )}
        </TabsContent>

        {/* My Gigs Tab */}
        <TabsContent value="my-gigs" className="space-y-3">
          {myGigsLoading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-20 w-full" />
              </Card>
            ))
          ) : myGigs.length === 0 ? (
            <Card className="p-8 text-center" data-testid="empty-my-gigs">
              <Home className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium">No gigs yet</p>
              <p className="text-xs text-muted-foreground mt-1">Accept gigs from the Available Gigs tab to see them here.</p>
            </Card>
          ) : (
            myGigs.map(gig => (
              <GigCard
                key={gig.id}
                gig={gig}
                mode="my-gigs"
                onComplete={() => completeMutation.mutate(gig.id)}
                isCompleting={completeMutation.isPending && completeMutation.variables === gig.id}
              />
            ))
          )}
        </TabsContent>

        {/* Earnings Tab */}
        <TabsContent value="earnings" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Available Balance</p>
              <p className="text-xl font-bold text-primary" data-testid="text-available-balance">
                {earningsLoading ? "—" : `$${availableBalance.toFixed(2)}`}
              </p>
            </div>
            <Button
              onClick={() => {
                setPayoutAmount(availableBalance.toFixed(2));
                setPayoutDialogOpen(true);
              }}
              disabled={availableBalance <= 0}
              data-testid="button-request-payout"
            >
              Request Payout
            </Button>
          </div>

          {earningsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : payouts.length === 0 ? (
            <Card className="p-8 text-center" data-testid="empty-earnings">
              <DollarSign className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium">No earnings yet</p>
              <p className="text-xs text-muted-foreground mt-1">Complete your first showing to start earning.</p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-earnings">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium text-xs text-muted-foreground">Date</th>
                      <th className="px-4 py-3 text-left font-medium text-xs text-muted-foreground">Description</th>
                      <th className="px-4 py-3 text-left font-medium text-xs text-muted-foreground">Type</th>
                      <th className="px-4 py-3 text-right font-medium text-xs text-muted-foreground">Amount</th>
                      <th className="px-4 py-3 text-left font-medium text-xs text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((payout) => {
                      const date = payout.createdAt ? new Date(payout.createdAt).toLocaleDateString() : "—";
                      const isNegative = payout.amount < 0;
                      return (
                        <tr key={payout.id} className="border-b last:border-0 hover:bg-muted/30" data-testid={`row-payout-${payout.id}`}>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{date}</td>
                          <td className="px-4 py-3 text-xs max-w-[180px] truncate">{payout.description}</td>
                          <td className="px-4 py-3"><StatusBadge status={payout.type} /></td>
                          <td className={`px-4 py-3 text-right font-medium text-xs ${isNegative ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                            {isNegative ? "-" : "+"}${Math.abs(payout.amount).toFixed(2)}
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={payout.status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Payout Dialog */}
      <Dialog open={payoutDialogOpen} onOpenChange={setPayoutDialogOpen}>
        <DialogContent data-testid="dialog-payout">
          <DialogHeader>
            <DialogTitle>Request Payout</DialogTitle>
            <DialogDescription>
              Transfer your earnings to your bank account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Available Balance</span>
                <span className="font-semibold">${availableBalance.toFixed(2)}</span>
              </div>
              {chaperoneApp?.bankAccountNumber && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bank Account</span>
                  <span className="font-medium">••••{chaperoneApp.bankAccountNumber.slice(-4)}</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Amount to Withdraw ($)</Label>
              <Input
                type="number"
                min="1"
                max={availableBalance}
                step="0.01"
                value={payoutAmount}
                onChange={e => setPayoutAmount(e.target.value)}
                data-testid="input-payout-amount"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayoutDialogOpen(false)} data-testid="button-cancel-payout">
              Cancel
            </Button>
            <Button
              onClick={() => payoutMutation.mutate(parseFloat(payoutAmount))}
              disabled={payoutMutation.isPending || !payoutAmount || parseFloat(payoutAmount) <= 0 || parseFloat(payoutAmount) > availableBalance}
              data-testid="button-confirm-payout"
            >
              {payoutMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Transfer to Bank
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
