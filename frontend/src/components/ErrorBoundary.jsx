import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Frontline ErrorBoundary caught an uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    try {
      sessionStorage.removeItem('oa_ner_auth_session');
    } catch (e) {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-2xl p-6 shadow-2xl text-center">
            <div className="w-14 h-14 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/20">
              <span className="material-symbols-outlined text-[32px]">emergency</span>
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Triage Interface Safe-Mode</h2>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              An unexpected interface error occurred while rendering the clinical module. Patient session data has been preserved in offline storage.
            </p>
            {this.state.error && (
              <div className="bg-black/50 p-2.5 rounded-lg text-left font-mono text-[10px] text-red-300 mb-4 overflow-x-auto border border-red-500/20 max-h-28">
                {this.state.error.toString()}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-all"
              >
                Retry
              </button>
              <button
                onClick={this.handleReset}
                className="flex-1 py-2 px-3 rounded-xl bg-primary hover:bg-primary-hover text-xs font-semibold text-white transition-all shadow-md"
              >
                Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
