import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LangProvider } from "@/context/LangContext";
import BottomNav from "@/components/BottomNav";
import { useIsLandscape } from "@/hooks/useIsLandscape";
import Index from "./pages/Index";
import HistoryPage from "./pages/HistoryPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import ProfilePage from "./pages/ProfilePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppShell() {
  const isLandscape = useIsLandscape();

  return (
    <BrowserRouter>
      {isLandscape ? (
        /* ── Landscape: side nav + scrollable content ─────────────────── */
        <div className="flex h-screen overflow-hidden bg-background">
          <BottomNav />
          <main className="flex-1 h-screen overflow-y-auto">
            <div className="max-w-[860px] mx-auto">
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
          </main>
        </div>
      ) : (
        /* ── Portrait: current bottom-nav layout ───────────────────────── */
        <div className="max-w-[430px] mx-auto min-h-screen relative overflow-x-hidden bg-background">
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <BottomNav />
        </div>
      )}
    </BrowserRouter>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LangProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppShell />
      </TooltipProvider>
    </LangProvider>
  </QueryClientProvider>
);

export default App;
