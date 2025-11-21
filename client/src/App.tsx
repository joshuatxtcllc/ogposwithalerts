import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { ErrorBoundary } from "react-error-boundary";
import Dashboard from "@/pages/AnalyticsDashboard";
import VendorOrders from "@/pages/VendorOrders";
import Login from "@/pages/Login";
import CustomerPortal from "@/components/CustomerPortal";
import POSIntegration from "@/pages/POSIntegrationSimple";
import Progress from "@/pages/Progress";
import Orders from "@/pages/Orders";
import Customers from "@/pages/Customers";
import Analytics from "@/pages/Analytics";
import Schedule from "@/pages/Schedule";
import TimeTracking from "@/pages/TimeTracking";
import Notifications from "@/pages/Notifications";
import Reports from "@/pages/Reports";
import AdminPortal from './pages/AdminPortal';
import Diagnostics from './pages/Diagnostics';
import Invoices from "@/pages/Invoices";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";
import RelaunchPlan from "@/pages/RelaunchPlan"; // Import the new component

function Router() {
  const { isAuthenticated, isLoading, refetch } = useAuth();

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refetch();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refetch]);


  return (
    <Switch>
      {isLoading ? (
        <Route path="*" component={() => <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="text-white">Loading...</div></div>} />
      ) : !isAuthenticated ? (
        <>
          <Route path="/" component={Login} />
          <Route path="/track" component={CustomerPortal} />
          <Route path="/track/:trackingId" component={CustomerPortal} />
          <Route component={Login} />
        </>
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/quick-wins" component={Orders} />
          <Route path="/vendor-orders" component={VendorOrders} />
          <Route path="/orders" component={Orders} />
          <Route path="/customers" component={Customers} />
          <Route path="/customers/new" component={Customers} />
          <Route path="/analytics" component={Analytics} />
          <Route path="/analytics/workload" component={Analytics} />
          <Route path="/analytics/performance" component={Analytics} />
          <Route path="/analytics/time-tracking" component={Analytics} />
          <Route path="/schedule" component={Schedule} />
          <Route path="/time-tracking" component={TimeTracking} />
          <Route path="/notifications" component={Notifications} />
          <Route path="/reports" component={Reports} />
          <Route path="/reports/daily" component={Reports} />
          <Route path="/reports/weekly" component={Reports} />
          <Route path="/reports/monthly" component={Reports} />
          <Route path="/pos-integration" component={POSIntegration} />
          <Route path="/progress" component={Progress} />
          <Route path="/track" component={CustomerPortal} />
          <Route path="/track/:trackingId" component={CustomerPortal} />
          <Route path="/admin-portal" component={AdminPortal} />
          <Route path="/diagnostics" component={Diagnostics} />
          <Route path="/invoices" component={Invoices} />
          <Route path="/relaunch-plan" component={RelaunchPlan} /> {/* Add the new route */}
          <Route component={NotFound} />
        </>
      )}
    </Switch>
  );
}

function ErrorFallback({error}: {error: Error}) {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-red-500 mb-4">🚨 CRITICAL APPLICATION ERROR</h1>
        <p className="text-gray-300 mb-4">Enterprise system failure detected</p>
        <details className="text-left bg-gray-800 p-4 rounded">
          <summary className="cursor-pointer text-yellow-400">Error Details</summary>
          <pre className="text-red-400 text-sm mt-2">{error.message}</pre>
        </details>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
        >
          Reload Application
        </button>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <div className="min-h-screen bg-gray-950 text-white">
            <Toaster />
            <Router />
          </div>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
