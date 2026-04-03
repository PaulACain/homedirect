import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, Bed, Bath, Maximize, MapPin } from "lucide-react";
import type { Listing } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(price);
}

const propertyTypeLabels: Record<string, string> = {
  single_family: "Single Family",
  condo: "Condo",
  townhouse: "Townhouse",
  multi_family: "Multi Family",
};

export function ListingCard({ listing }: { listing: Listing }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const images: string[] = JSON.parse(listing.images || "[]");

  const { data: favData } = useQuery({
    queryKey: ["/api/favorites", user?.id, listing.id],
    queryFn: () => user ? apiRequest("GET", `/api/favorites/${user.id}/${listing.id}`).then(r => r.json()) : Promise.resolve({ isFavorite: false }),
    enabled: !!user,
  });

  const toggleFav = useMutation({
    mutationFn: async () => {
      if (!user) return;
      if (favData?.isFavorite) {
        await apiRequest("DELETE", `/api/favorites/${user.id}/${listing.id}`);
      } else {
        await apiRequest("POST", "/api/favorites", { userId: user.id, listingId: listing.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorites", user?.id, listing.id] });
    },
  });

  return (
    <Card className="group overflow-hidden" data-testid={`card-listing-${listing.id}`}>
      <div className="relative aspect-[4/3] overflow-hidden">
        <Link href={`/listing/${listing.id}`}>
          <img
            src={images[0] || "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800"}
            alt={listing.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            crossOrigin="anonymous"
            loading="lazy"
            data-testid={`img-listing-${listing.id}`}
          />
        </Link>
        <div className="absolute left-3 top-3 flex gap-1.5">
          <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm" data-testid={`badge-type-${listing.id}`}>
            {propertyTypeLabels[listing.propertyType] || listing.propertyType}
          </Badge>
          {listing.status === "pending" && (
            <Badge variant="destructive" data-testid={`badge-status-${listing.id}`}>Under Contract</Badge>
          )}
        </div>
        {user && (
          <Button
            size="icon"
            variant="ghost"
            className="absolute right-3 top-3 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm"
            onClick={(e) => { e.preventDefault(); toggleFav.mutate(); }}
            data-testid={`button-favorite-${listing.id}`}
          >
            <Heart className={`h-4 w-4 ${favData?.isFavorite ? "fill-red-500 text-red-500" : ""}`} />
          </Button>
        )}
      </div>
      <Link href={`/listing/${listing.id}`} className="block p-4 no-underline">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="text-lg font-semibold" data-testid={`text-price-${listing.id}`}>{formatPrice(listing.price)}</span>
          {listing.hoaFee && listing.hoaFee > 0 && (
            <span className="text-xs text-muted-foreground">+${listing.hoaFee}/mo HOA</span>
          )}
        </div>
        <h3 className="mb-1 text-sm font-medium leading-snug" data-testid={`text-title-${listing.id}`}>{listing.title}</h3>
        <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span data-testid={`text-address-${listing.id}`}>{listing.address}, {listing.city}, {listing.state}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1" data-testid={`text-beds-${listing.id}`}>
            <Bed className="h-3.5 w-3.5" /> {listing.bedrooms} bd
          </span>
          <span className="flex items-center gap-1" data-testid={`text-baths-${listing.id}`}>
            <Bath className="h-3.5 w-3.5" /> {listing.bathrooms} ba
          </span>
          <span className="flex items-center gap-1" data-testid={`text-sqft-${listing.id}`}>
            <Maximize className="h-3.5 w-3.5" /> {listing.sqft.toLocaleString()} sqft
          </span>
        </div>
      </Link>
    </Card>
  );
}
