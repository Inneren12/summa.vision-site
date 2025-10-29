"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

export interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Optional keys that reset the boundary when their identity changes.
   */
  resetKeys?: readonly unknown[];
  /**
   * Callback invoked after the boundary resets in response to the retry action.
   */
  onRetry?: () => void;
  /**
   * Override the title shown in the fallback.
   */
  title?: string;
  /**
   * Optional description displayed under the title.
   */
  description?: string;
  /**
   * Custom label for the retry button.
   */
  retryLabel?: string;
}

interface ErrorBoundaryState {
  error?: Error;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: undefined };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("ErrorBoundary captured an error", error, errorInfo);
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (!this.state.error) {
      return;
    }

    const { resetKeys } = this.props;
    if (!resetKeys) {
      return;
    }

    if (haveResetKeysChanged(resetKeys, prevProps.resetKeys)) {
      this.setState({ error: undefined });
    }
  }

  private handleRetry = () => {
    this.setState({ error: undefined }, () => {
      this.props.onRetry?.();
    });
  };

  render() {
    const { children, title, description, retryLabel } = this.props;
    const { error } = this.state;

    if (error) {
      return (
        <div
          role="alert"
          className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
        >
          <div className="space-y-1">
            <p className="text-sm font-semibold">{title ?? "We couldn’t render this widget"}</p>
            <p className="text-sm text-red-700">
              {description ??
                "Try again or refresh the page. If the issue persists, contact support."}
            </p>
            <p className="text-xs text-red-600" role="status">
              {error.message}
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleRetry}
            className="inline-flex items-center justify-center rounded-md border border-red-300 bg-white px-3 py-1 text-sm font-medium text-red-700 shadow-sm transition hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
          >
            {retryLabel ?? "Retry"}
          </button>
        </div>
      );
    }

    return children;
  }
}

function haveResetKeysChanged(
  current: readonly unknown[] | undefined,
  previous: readonly unknown[] | undefined,
): boolean {
  if (!current && !previous) {
    return false;
  }

  if (!current || !previous) {
    return true;
  }

  if (current.length !== previous.length) {
    return true;
  }

  for (let index = 0; index < current.length; index += 1) {
    if (!Object.is(current[index], previous[index])) {
      return true;
    }
  }

  return false;
}

export interface SkeletonProps {
  /** Number of placeholder rows to render. */
  lines?: number;
  /** Optional custom class for the wrapper. */
  className?: string;
}

export function Skeleton({ lines = 3, className = "" }: SkeletonProps) {
  const safeLines = Number.isFinite(lines) ? Math.max(0, Math.trunc(lines)) : 0;
  return (
    <div className={["animate-pulse space-y-2", className].filter(Boolean).join(" ")}>
      {Array.from({ length: safeLines }).map((_, index) => (
        <div key={index} className="h-4 rounded bg-neutral-200" />
      ))}
    </div>
  );
}

export interface EmptyProps {
  /** Title displayed for the empty state. */
  title?: string;
  /** Optional reason explaining the empty state. */
  reason?: string;
  /** Additional details rendered below the reason. */
  children?: ReactNode;
  /** Optional retry callback to surface an action. */
  onRetry?: () => void;
  /** Custom label for the retry action. */
  retryLabel?: string;
  /** Additional wrapper classes. */
  className?: string;
}

export function Empty({
  title = "No data available",
  reason = "There’s nothing to display yet.",
  children,
  onRetry,
  retryLabel = "Retry",
  className = "",
}: EmptyProps) {
  return (
    <div
      className={[
        "flex flex-col gap-2 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-6 text-neutral-700",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{title}</p>
      <p className="text-sm text-neutral-600">{reason}</p>
      {children ? <div className="text-sm text-neutral-500">{children}</div> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 inline-flex w-fit items-center justify-center rounded-md border border-neutral-300 bg-white px-3 py-1 text-sm font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
