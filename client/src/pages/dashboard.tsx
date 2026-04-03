import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListingCard } from "@/components/listing-card";
import { apiRequest } from "@/lib/queryClient";
import {
  Home, FileText, MessageSquare, Eye, DollarSign, Bot, Clock, ArrowRight, Plus, MapPin,
  CheckCircle2, Circle, AlertCircle
} from "lucide-react";
import type { Listing, Offer, Walkthrough, Transaction, Document as Doc } from "@shared/schema";

function formatPrice(p: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(p);
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  countered: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  requested: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  assigned: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  confirmed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: myListings = [] } = useQuery<Listing[]>({
    queryKey: ["/api/listings/seller", user?.id],
    queryFn: () => apiRequest("GET", `/api/listings/seller/${user?.id}`).then(r => r.json()),
    enabled: !!user && (user.role === "seller" || user.role === "admin"),
  });

  const { data: myOffers = [] } = useQuery<Offer[]>({
    queryKey: ["/api/offers/buyer", user?.id],
    queryFn: () => apiRequest("GET", `/api/offers/buyer/${user?.id}`).then(r => r.json()),
    enabled: !!user,
  });

  const { data: myWalkthroughs = [] } = useQuery<Walkthrough[]>({
    queryKey: ["/api/walkthroughs/buyer", user?.id],
    queryFn: () => apiRequest("GET", `/api/walkthroughs/buyer/${user?.id}`).then(r => r.json()),
    enabled: !!user,
  });

  const { data: chaperoneGigs = [] } = useQuery<Walkthrough[]>({
    queryKey: ["/api/walkthroughs/available"],
    queryFn: () => apiRequest("GET", "/api/walkthroughs/available").then(r => r.json()),
    enabled: !!user && user.role === "chaperone",
  });

  const { data: myTransactions = [] } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions/buyer", user?.id],
    queryFn: () => apiRequest("GET", `/api/transactions/buyer/${user?.id}`).then(r => r.json()),
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="py-20 text-center">
        <Bot className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
        <h2 className="text-lg font-semibold">Sign in to view your dashboard</h2>
        <p className="mt-1 text-sm text-muted-foreground">Track your offers, walkthroughs, and transactions.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6" data-testid="page-dashboard">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold" data-testid="text-welcome">Welcome, {user.fullName.split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground capitalize">{user.role} Dashboard</p>
        </div>
        {(user.role === "seller" || user.role === "admin") && (
          <Button size="sm" onClick={() => setLocation("/sell")} data-testid="button-new-listing">
            <Plus className="mr-1 h-4 w-4" /> New Listing
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-4" data-testid="stat-listings">
          <Home className="mb-1 h-4 w-4 text-muted-foreground" />
          <div className="text-xl font-bold">{myListings.length}</div>
          <p className="text-xs text-muted-foreground">My Listings</p>
        </Card>
        <Card className="p-4" data-testid="stat-offers">
          <DollarSign className="mb-1 h-4 w-4 text-muted-foreground" />
          <div className="text-xl font-bold">{myOffers.length}</div>
          <p className="text-xs text-muted-foreground">Active Offers</p>
        </Card>
        <Card className="p-4" data-testid="stat-walkthroughs">
          <Eye className="mb-1 h-4 w-4 text-muted-foreground" />
          <div className="text-xl font-bold">{myWalkthroughs.length}</div>
          <p className="text-xs text-muted-foreground">Walkthroughs</p>
        </Card>
        <Card className="p-4" data-testid="stat-transactions">
          <FileText className="mb-1 h-4 w-4 text-muted-foreground" />
          <div className="text-xl font-bold">{myTransactions.length}</div>
          <p className="text-xs text-muted-foreground">Transactions</p>
        </Card>
      </div>

      <Tabs defaultValue={user.role === "chaperone" ? "gigs" : "offers"} data-testid="tabs-dashboard">
        <TabsList>
          {user.role !== "chaperone" && <TabsTrigger value="offers">Offers</TabsTrigger>}
          {user.role !== "chaperone" && <TabsTrigger value="walkthroughs">Walkthroughs</TabsTrigger>}
          {(user.role === "seller" || user.role === "admin") && <TabsTrigger value="listings">My Listings</TabsTrigger>}
          {user.role === "chaperone" && <TabsTrigger value="gigs">Available Gigs</TabsTrigger>}
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        {/* Offers Tab */}
        <TabsContent value="offers" className="mt-4">
          {myOffers.length === 0 ? (
            <div className="py-12 text-center">
              <DollarSign className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
              <p className="text-sm font-medium">No offers yet</p>
              <p className="text-xs text-muted-foreground">Browse listings and make your first offer</p>
              <Button size="sm" variant="secondary" className="mt-3" onClick={() => setLocation("/search")}>
                Browse Listings
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {myOffers.map((offer) => (
                <Card key={offer.id} className="flex items-center justify-between p-4" data-testid={`card-offer-${offer.id}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Offer: {formatPrice(offer.amount)}</span>
                      <Badge variant="outline" className={statusColors[offer.status]}>{offer.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Listing #{offer.listingId} - {offer.createdAt?.split("T")[0]}</p>
                  </div>
                  <Link href={`/negotiate/${offer.id}`}>
                    <Button size="sm" variant="ghost">
                      <MessageSquare className="mr-1 h-4 w-4" /> Negotiate
                    </Button>
                  </Link>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Walkthroughs Tab */}
        <TabsContent value="walkthroughs" className="mt-4">
          {myWalkthroughs.length === 0 ? (
            <div className="py-12 text-center">
              <Eye className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
              <p className="text-sm font-medium">No walkthroughs scheduled</p>
              <p className="text-xs text-muted-foreground">Find a home and schedule a $20 chaperone walkthrough</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myWalkthroughs.map((wt) => (
                <Card key={wt.id} className="p-4" data-testid={`card-walkthrough-${wt.id}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Listing #{wt.listingId}</span>
                        <Badge variant="outline" className={statusColors[wt.status]}>{wt.status}</Badge>
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {wt.scheduledDate} at {wt.scheduledTime}</span>
                        <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> $20 chaperone fee</span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Listings Tab */}
        <TabsContent value="listings" className="mt-4">
          {myListings.length === 0 ? (
            <div className="py-12 text-center">
              <Home className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
              <p className="text-sm font-medium">No listings yet</p>
              <p className="text-xs text-muted-foreground">List your first property and save thousands</p>
              <Button size="sm" className="mt-3" onClick={() => setLocation("/sell")}>
                <Plus className="mr-1 h-4 w-4" /> Create Listing
              </Button>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {myListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Chaperone Gigs Tab */}
        <TabsContent value="gigs" className="mt-4">
          {chaperoneGigs.length === 0 ? (
            <div className="py-12 text-center">
              <MapPin className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
              <p className="text-sm font-medium">No available gigs</p>
              <p className="text-xs text-muted-foreground">Check back soon for walkthrough chaperone opportunities ($20 each)</p>
            </div>
          ) : (
            <div className="space-y-3">
              {chaperoneGigs.map((gig) => (
                <Card key={gig.id} className="flex items-center justify-between p-4" data-testid={`card-gig-${gig.id}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Walkthrough - Listing #{gig.listingId}</span>
                      <Badge variant="secondary">$20</Badge>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{gig.scheduledDate} at {gig.scheduledTime}</span>
                    </div>
                  </div>
                  <Button size="sm" onClick={async () => {
                    await apiRequest("PATCH", `/api/walkthroughs/${gig.id}`, { chaperoneId: user.id, status: "assigned" });
                    window.location.reload();
                  }} data-testid={`button-accept-gig-${gig.id}`}>
                    Accept Gig
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="mt-4">
          {myTransactions.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
              <p className="text-sm font-medium">No active transactions</p>
              <p className="text-xs text-muted-foreground">Accepted offers become transactions tracked here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myTransactions.map((txn) => (
                <Card key={txn.id} className="p-4" data-testid={`card-transaction-${txn.id}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-sm font-medium">Transaction #{txn.id}</span>
                      <Badge variant="outline" className={`ml-2 ${statusColors[txn.status]}`}>{txn.status}</Badge>
                    </div>
                    <span className="text-sm font-semibold">{formatPrice(txn.salePrice)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                    <div className="flex items-center gap-1.5">
                      {txn.escrowStatus === "not_started" ? <Circle className="h-3 w-3 text-muted-foreground" /> : txn.escrowStatus === "disbursed" ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <AlertCircle className="h-3 w-3 text-blue-500" />}
                      <span>Escrow: {txn.escrowStatus?.replace("_", " ")}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {txn.titleStatus === "not_started" ? <Circle className="h-3 w-3 text-muted-foreground" /> : txn.titleStatus === "clear" ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <AlertCircle className="h-3 w-3 text-blue-500" />}
                      <span>Title: {txn.titleStatus?.replace("_", " ")}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {txn.inspectionStatus === "not_started" ? <Circle className="h-3 w-3 text-muted-foreground" /> : <CheckCircle2 className="h-3 w-3 text-green-500" />}
                      <span>Inspection: {txn.inspectionStatus?.replace("_", " ")}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {txn.appraisalStatus === "not_started" ? <Circle className="h-3 w-3 text-muted-foreground" /> : <CheckCircle2 className="h-3 w-3 text-green-500" />}
                      <span>Appraisal: {txn.appraisalStatus?.replace("_", " ")}</span>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                    <span>Platform fee (1%): {formatPrice(txn.platformFee)}</span>
                    {txn.closingDate && <span>Est. closing: {txn.closingDate}</span>}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
