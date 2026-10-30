import { Toaster } from "@/components/ui/sonner";
import React, { useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import { DashboardLayoutSkeleton } from "./components/DashboardLayoutSkeleton";
import { useAuth } from "./_core/hooks/useAuth";
import { getEntryRoute } from "./authRoute";
import Dashboard from "./pages/Dashboard";
import MasterInventory from "./pages/MasterInventory";
import LocationDetail from "@/pages/LocationDetail";
import AuditHistory from "@/pages/AuditHistory";
import Login from "@/pages/Login";
import AdminUsers from "./pages/AdminUsers";
import ChangePassword from "./pages/ChangePassword";
import NonWorkingDevices from "./pages/NonWorkingDevices";

function Router() {
  const [location, setLocation] = useLocation();
  const { user, loading } = useAuth();

  const entryRoute = getEntryRoute({
    location,
    loading,
    isAuthenticated: Boolean(user),
    mustChangePassword: Boolean(user?.mustChangePassword),
  });

  useEffect(() => {
    if (entryRoute === "redirect") setLocation("/login");
    if (entryRoute === "password-change-redirect") setLocation("/change-password");
  }, [entryRoute, setLocation]);

  if (entryRoute === "login") return <Login />;
  if (entryRoute === "password-change") return <ChangePassword />;
  if (entryRoute === "loading" || entryRoute === "redirect" || entryRoute === "password-change-redirect") {
    return <DashboardLayoutSkeleton />;
  }

  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/master" component={MasterInventory} />
        <Route path="/non-working" component={NonWorkingDevices} />
        <Route path="/location/:id" component={LocationDetail} />
        <Route path="/audit" component={AuditHistory} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/change-password" component={ChangePassword} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
