import React, { Suspense, lazy, useEffect } from "react";
import { HashRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";

// Everything past the login/register gate is lazy-loaded — recharts,
// framer-motion-heavy pages, and the markdown-rendering chat page were
// all being bundled into the initial load even though most sessions only
// ever touch a couple of these routes. Splitting them means the first
// paint only needs the auth screens' code, not the whole app.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Transactions = lazy(() => import("./pages/Transactions"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Budgets = lazy(() => import("./pages/Budgets"));
const Goals = lazy(() => import("./pages/Goals"));
const Notes = lazy(() => import("./pages/Notes"));
const Assistant = lazy(() => import("./pages/Assistant"));
const AskAnything = lazy(() => import("./pages/AskAnything"));
const Settings = lazy(() => import("./pages/Settings"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

function RouteFallback() {
  return <div className="auth-loading">Loading...</div>;
}

function DataLoadError() {
  const { retryLoad, logout } = useApp();
  return (
    <div className="auth-loading" style={{ flexDirection: "column", gap: 14, textAlign: "center", padding: 24 }}>
      <div style={{ fontWeight: 700 }}>Couldn't load your data / 데이터를 불러오지 못했어요</div>
      <div style={{ fontSize: 13, opacity: 0.75, maxWidth: 360 }}>
        Check your internet connection and try again. Your saved data is safe.
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn-primary" onClick={retryLoad}>Retry / 다시 시도</button>
        <button className="btn-secondary" onClick={logout}>Log out</button>
      </div>
    </div>
  );
}

function RequireAuth({ children }) {
  const { user, data, dataError, authLoading } = useApp();
  if (authLoading) return <div className="auth-loading">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  // Loading failed — show a retry screen instead of an endless spinner, and
  // never fall back to empty data (the next save would wipe the real data).
  if (dataError) return <DataLoadError />;
  // user is confirmed, but their financial data may still be loading from
  // Supabase — without this check, pages underneath try to read data.transactions
  // on a null value for a brief moment and crash, which looked like "I have to
  // refresh to see the dashboard."
  if (!data) return <div className="auth-loading">Loading...</div>;
  return children;
}

function RedirectIfAuthed({ children }) {
  const { user, authLoading } = useApp();
  if (authLoading) return <div className="auth-loading">Loading...</div>;
  if (user) return <Navigate to="/app/dashboard" replace />;
  return children;
}

// Hash routes keep the old scroll position — start each page at the top.
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function Routing() {
  const { recoveryMode } = useApp();
  // Opened a password-reset email link: show the "set a new password" screen
  // no matter which route the URL points at.
  if (recoveryMode) {
    return <Suspense fallback={<RouteFallback />}><ResetPassword /></Suspense>;
  }
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
        <Route path="/register" element={<RedirectIfAuthed><Register /></RedirectIfAuthed>} />
        <Route path="/app" element={<RequireAuth><Layout /></RequireAuth>}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="budgets" element={<Budgets />} />
          <Route path="goals" element={<Goals />} />
          <Route path="notes" element={<Notes />} />
          <Route path="assistant" element={<Assistant />} />
          <Route path="ask" element={<AskAnything />} />
          <Route path="receipts" element={<Navigate to="/app/transactions?source=ai" replace />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <HashRouter>
          <ScrollToTop />
          <Routing />
        </HashRouter>
      </AppProvider>
    </ErrorBoundary>
  );
}
