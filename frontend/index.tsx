import React from 'react';
import ReactDOM from 'react-dom/client';
import Dashboard from './pages/Dashboard';
import './theme.css';

// Hide loading screen immediately after React loads
const hideLoadingScreen = () => {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.style.display = 'none';
  }
};

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Dashboard error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          padding: '2rem',
          textAlign: 'center',
        }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" style={{ marginBottom: '1rem' }}>
            <path d="M12 2L2 20h20L12 2zm0 3.5L19.5 18.5H4.5L12 5.5z" fill="#dc3545"/>
            <path d="M11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" fill="#dc3545"/>
          </svg>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Dashboard Error</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Something went wrong loading the dashboard.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: 'var(--primary-blue)',
              color: 'var(--text-inverse)',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '14px',
              fontWeight: 'var(--font-semibold)',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// App component
const App: React.FC = () => {
  React.useEffect(() => {
    hideLoadingScreen();
  }, []);

  return (
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  );
};

// Mount the app
const container = document.getElementById('root');
if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log('Dashboard mounted successfully');
} else {
  console.error('Could not find root element');
  // Show error fallback
  const errorFallback = document.getElementById('error-fallback');
  if (errorFallback) {
    errorFallback.style.display = 'flex';
  }
}
