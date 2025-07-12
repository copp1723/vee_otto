import React from 'react';
import ReactDOM from 'react-dom/client';

// Simple test component
const TestApp: React.FC = () => {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0e27',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '2rem' }}>🚀 Vee Otto Dashboard</h1>
      <p style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Dashboard is loading...</p>
      <p style={{ color: '#4ecdc4' }}>If you see this, React is working!</p>
      
      <div style={{ marginTop: '2rem', padding: '2rem', background: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}>
        <h2 style={{ marginBottom: '1rem' }}>Test Metrics</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li>✅ React: Loaded</li>
          <li>✅ Webpack: Compiled</li>
          <li>✅ TypeScript: Working</li>
        </ul>
      </div>
    </div>
  );
};

// Mount the app
const container = document.getElementById('root');
if (container) {
  // Hide loading screen immediately
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.style.display = 'none';
  }
  
  const root = ReactDOM.createRoot(container);
  root.render(<TestApp />);
  
  console.log('✅ React Test App Mounted Successfully!');
} else {
  console.error('❌ Could not find root element');
}
