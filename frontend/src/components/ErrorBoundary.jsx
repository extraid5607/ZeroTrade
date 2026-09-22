import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    localStorage.removeItem('zerotrade_user_watchlists');
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#090D14] text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-500 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-black mb-2">Something went wrong</h1>
          <p className="text-sm text-gray-400 max-w-md mb-4 font-mono bg-black/40 p-3 rounded-xl border border-gray-800 text-left overflow-x-auto">
            {this.state.error?.toString() || 'Unknown rendering error'}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-bold text-white transition-all flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reload Terminal</span>
            </button>
            <button
              onClick={this.handleReset}
              className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm font-bold text-gray-300 transition-all"
            >
              Reset Cache & Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
