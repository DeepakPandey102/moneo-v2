import React from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Analytics from "./pages/Analytics";
import Budgets from "./pages/Budgets";
import Goals from "./pages/Goals";
import Notes from "./pages/Notes";
import Assistant from "./pages/Assistant";
import AskAnything from "./pages/AskAnything";
import Settings from "./pages/Settings";

function RequireAuth({ children }) {
  const { user, data, authLoading } = useApp();
  if (authLoading) return <div className="auth-loading">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
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

function Routing() {
  return (
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
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <HashRouter>
          <Routing />
        </HashRouter>
      </AppProvider>
    </ErrorBoundary>
  );
}
