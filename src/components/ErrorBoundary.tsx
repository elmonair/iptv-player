import { Component, type ReactNode } from 'react'
import { Home, RefreshCw, AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] React error caught:', error)
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack)
    this.setState({ errorInfo })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-800 rounded-xl border border-slate-700 p-6 text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            
            <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-slate-400 text-sm mb-6">
              The app encountered an unexpected error. You can try reloading or go back home.
            </p>

            {this.state.error && (
              <div className="bg-slate-900 rounded-lg p-3 mb-6 text-left overflow-hidden">
                <p className="text-red-400 text-xs font-mono truncate">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleGoHome}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <Home className="w-4 h-4" />
                <span>Go Home</span>
              </button>
              <button
                onClick={this.handleReload}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload</span>
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}