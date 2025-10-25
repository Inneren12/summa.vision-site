"use client";

import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

import type { JsErrorCorrelation } from "@/lib/reportError";
import { reportJsError } from "@/lib/reportError";

interface GlobalErrorBoundaryProps {
  children: ReactNode;
  snapshotId: string;
  correlation: JsErrorCorrelation;
}

interface GlobalErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends Component<
  GlobalErrorBoundaryProps,
  GlobalErrorBoundaryState
> {
  state: GlobalErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): GlobalErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const stack = error.stack || errorInfo.componentStack || undefined;
    void reportJsError(this.props.snapshotId, this.props.correlation, {
      message: error.message,
      stack,
      url: typeof window !== "undefined" ? window.location.href : undefined,
    }).catch(() => {
      /* ignore */
    });
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error(error);
    }
  }

  componentDidUpdate(prevProps: GlobalErrorBoundaryProps) {
    if (!this.state.hasError) return;
    const childrenChanged = prevProps.children !== this.props.children;
    const snapshotChanged = prevProps.snapshotId !== this.props.snapshotId;
    if (childrenChanged || snapshotChanged) {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (this.state.hasError) {
      if (process.env.NODE_ENV !== "production") {
        return (
          <section className="space-y-4 p-8">
            <header>
              <h2 className="text-xl font-semibold text-fg">Application error</h2>
              <p className="text-sm text-muted">
                The application has encountered an unexpected error.
              </p>
            </header>
            <pre className="overflow-auto rounded border border-muted/40 bg-muted/10 p-4 text-xs">
              {this.state.error?.stack ?? this.state.error?.message ?? "Unknown error"}
            </pre>
          </section>
        );
      }
      return null;
    }

    return this.props.children;
  }
}
