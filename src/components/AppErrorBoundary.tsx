import React from "react"

type AppErrorBoundaryProps = {
  children: React.ReactNode
}

type AppErrorBoundaryState = {
  hasError: boolean
  message: string
}

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
    message: "",
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message || "Unexpected error." }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("AppErrorBoundary caught error", error, info)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900">
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="mt-3 text-sm text-slate-600">
            The page hit an unexpected error. Try reloading the app.
          </p>
          {this.state.message ? (
            <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-500">
              {this.state.message}
            </p>
          ) : null}
          <button
            className="mt-6 inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            type="button"
            onClick={this.handleReload}
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
