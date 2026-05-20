'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global Error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily:
            "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          background: 'linear-gradient(135deg, #0a1628 0%, #162d49 100%)',
          color: '#e2e8f0',
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: '100%',
            padding: '48px 32px',
            textAlign: 'center',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 24,
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          {/* Icon */}
          <div
            style={{
              width: 72,
              height: 72,
              margin: '0 auto 24px',
              borderRadius: 20,
              background: 'rgba(239,68,68,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
            }}
          >
            ⚠️
          </div>

          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              margin: '0 0 8px',
              letterSpacing: '-0.02em',
            }}
          >
            Something went wrong
          </h1>

          <p
            style={{
              fontSize: 14,
              color: '#94a3b8',
              lineHeight: 1.6,
              margin: '0 0 32px',
            }}
          >
            An unexpected error occurred. Our team has been notified. You can try
            again or return to the homepage.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={reset}
              style={{
                padding: '12px 24px',
                borderRadius: 14,
                border: 'none',
                background: 'linear-gradient(135deg, #097d95, #1abbda)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'transform 0.15s, box-shadow 0.15s',
                boxShadow: '0 4px 20px rgba(9,125,149,0.3)',
              }}
              onMouseOver={(e) => {
                (e.target as HTMLButtonElement).style.transform = 'translateY(-1px)';
              }}
              onMouseOut={(e) => {
                (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
              }}
            >
              Try Again
            </button>

            <a
              href="/"
              style={{
                padding: '12px 24px',
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'transparent',
                color: '#e2e8f0',
                fontWeight: 600,
                fontSize: 14,
                textDecoration: 'none',
                display: 'block',
                transition: 'background 0.15s',
              }}
              onMouseOver={(e) => {
                (e.target as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.05)';
              }}
              onMouseOut={(e) => {
                (e.target as HTMLAnchorElement).style.background = 'transparent';
              }}
            >
              Go Home
            </a>
          </div>

          {error.digest && (
            <p
              style={{
                marginTop: 32,
                fontSize: 10,
                fontFamily: "'Courier New', monospace",
                color: 'rgba(148,163,184,0.5)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              Error ID: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
