import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Primetek Global Solutions — US-Based IT Staffing & Consulting';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #020617 0%, #0f172a 40%, #1e293b 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '60px 80px',
          fontFamily: 'Inter, sans-serif',
          position: 'relative',
        }}
      >
        {/* Top accent line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '6px',
            background: 'linear-gradient(90deg, #3b82f6, #60a5fa, #3b82f6)',
            display: 'flex',
          }}
        />

        {/* Company Name */}
        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: '-1px',
            textAlign: 'center',
            lineHeight: 1.1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: '20px',
          }}
        >
          <span>Primetek Global</span>
          <span style={{ color: '#60a5fa' }}>Solutions</span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 24,
            color: '#94a3b8',
            textAlign: 'center',
            maxWidth: '700px',
            lineHeight: 1.5,
            display: 'flex',
            marginBottom: '40px',
          }}
        >
          US-Based IT Staffing & Consulting
        </div>

        {/* Service Pills */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {['IT Staffing', 'Healthcare', 'Finance', 'Manufacturing', 'C2C Placements'].map(
            (service) => (
              <div
                key={service}
                style={{
                  padding: '8px 20px',
                  borderRadius: '20px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  color: '#93c5fd',
                  fontSize: 16,
                  display: 'flex',
                }}
              >
                {service}
              </div>
            )
          )}
        </div>

        {/* Location */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#64748b',
            fontSize: 16,
          }}
        >
          📍 Birmingham, Alabama, USA • primetekglobalsolutions.com
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
