import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import './styles.css';

class DashboardErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('OHORA dashboard render failure:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#faf5f1', color: '#4c382e', fontFamily: 'sans-serif' }}>
        <section role="alert" style={{ maxWidth: 560, padding: 28, background: '#fff', borderRadius: 14 }}>
          <h1 style={{ marginTop: 0 }}>Dashboard could not render</h1>
          <p>The published dashboard encountered a browser error. Please share the message below with the project owner.</p>
          <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{String(this.state.error.message || this.state.error)}</pre>
          <button type="button" onClick={() => window.location.reload()}>Reload</button>
        </section>
      </main>
    );
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DashboardErrorBoundary>
      <App />
    </DashboardErrorBoundary>
  </React.StrictMode>,
);
