import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; message: string; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{ padding: 12, fontSize: 11, color: "#e64553" }}>
          Error: {this.state.message}
          <button
            onClick={() => this.setState({ hasError: false, message: "" })}
            style={{ display: "block", marginTop: 8, padding: "4px 8px", cursor: "pointer", background: "none", border: "1px solid #e64553", color: "#e64553", borderRadius: 4 }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
