"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type GlobalErrorBoundaryProps = {
  children: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
  showStack?: boolean;
};

type GlobalErrorBoundaryState = {
  error: Error | null;
  info: ErrorInfo | null;
};

export class GlobalErrorBoundary extends Component<
  GlobalErrorBoundaryProps,
  GlobalErrorBoundaryState
> {
  override state: GlobalErrorBoundaryState = {
    error: null,
    info: null,
  };

  static getDerivedStateFromError(error: Error): GlobalErrorBoundaryState {
    return { error, info: null };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ info });
    if (typeof this.props.onError === "function") {
      this.props.onError(error, info);
    }
  }

  override render(): ReactNode {
    const { children, showStack } = this.props;
    const { error, info } = this.state;

    if (error && showStack) {
      return (
        <section
          className="space-y-4 border border-destructive/40 bg-destructive/5 p-6"
          role="alert"
        >
          <header>
            <h2 className="text-lg font-semibold text-destructive">Application error</h2>
          </header>
          <div className="space-y-2 text-sm">
            <pre className="whitespace-pre-wrap text-xs leading-relaxed">
              {(error.stack || error.message || "Unknown error").trim()}
            </pre>
            {info?.componentStack ? (
              <pre className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                {info.componentStack.trim()}
              </pre>
            ) : null}
          </div>
        </section>
      );
    }

    return children;
  }
}
