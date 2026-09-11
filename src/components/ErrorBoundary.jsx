import React from "react";

// Catches any unexpected render-time crash (like the data-not-loaded-yet
// race this was built to fix) and shows a recoverable message instead of
// a silent blank white page that only a manual refresh could escape.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Moneo crashed:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 16, padding: 24,
          fontFamily: "'Segoe UI', sans-serif", textAlign: "center",
        }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#14171F" }}>Something went wrong</div>
          <div style={{ fontSize: 14, color: "#6B7280", maxWidth: 380 }}>
            Moneo hit an unexpected error. Reloading usually fixes it.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "#16A34A", color: "white", border: "none",
              padding: "10px 20px", borderRadius: 10, fontWeight: 700,
              fontSize: 14, cursor: "pointer",
            }}
          >
            Reload Moneo
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
