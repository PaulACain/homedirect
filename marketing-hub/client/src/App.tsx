import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Sidebar from "@/components/sidebar";
import Dashboard from "@/pages/dashboard";
import CopyGenerator from "@/pages/copy-generator";
import CompetitorMonitor from "@/pages/competitor-monitor";
import Settings from "@/pages/settings";
import History from "@/pages/history";
import NotFound from "@/pages/not-found";

function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/copy-generator" component={CopyGenerator} />
          <Route path="/competitor-monitor" component={CompetitorMonitor} />
          <Route path="/history" component={History} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router hook={useHashLocation}>
          <AppShell />
        </Router>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
