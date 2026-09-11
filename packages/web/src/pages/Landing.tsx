import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QrCode, Smartphone, Gift } from 'lucide-react';
import { LegalLinks } from '../components/LegalLinks';
import { supabaseClient } from '../lib/supabase';
import { getMe } from '../lib/api';

const STEPS = [
  { icon: QrCode, title: 'Put your code by the register', body: 'One QR code, printed once. Tape it up and you’re live.' },
  { icon: Smartphone, title: 'Customers scan and enter their number', body: 'No app to download, no card to lose or forget.' },
  { icon: Gift, title: 'Confirm each visit', body: 'A tap from your staff. Points add up toward the reward you set.' },
];

export function Landing() {
  const navigate = useNavigate();
  // A signed-in staff member lands on their dashboard, not the marketing
  // page. Anonymous visitors have no session, so getSession() returns
  // instantly and they see this without a flash.
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    let cancelled = false;
    supabaseClient.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      const me = data.session ? await getMe().catch(() => null) : null;
      if (cancelled) return;
      if (me) {
        navigate(`/dashboard/${me.business.slug}`, { replace: true });
      } else {
        setChecking(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (checking) {
    return (
      <div className="page">
        <div className="page-content" style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <p className="text-muted">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-content" style={{ alignItems: 'center', textAlign: 'center', gap: 22, paddingTop: 48 }}>
        <img src="/logo.svg" alt="" width={80} height={80} />
        <div>
          <h1 style={{ margin: '0 0 6px' }}>TallyUp</h1>
          <p className="text-muted" style={{ margin: 0, fontSize: 16 }}>The punch card, without the paper.</p>
        </div>
        <p style={{ margin: 0, maxWidth: 380, fontSize: 15 }}>
          Reward your regulars without the stamps, the lost cards, or the shoebox of receipts.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <Link to="/signup" className="btn btn-primary" style={{ fontSize: 16, padding: '12px 22px' }}>
            Set up your shop
          </Link>
          <Link to="/login" style={{ fontSize: 13 }}>
            Staff sign in
          </Link>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            width: '100%',
            maxWidth: 420,
            marginTop: 10,
            textAlign: 'left',
          }}
        >
          {STEPS.map((step, i) => (
            <div key={step.title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div
                className="elev-sm"
                style={{
                  flex: 'none',
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-accent-700)',
                }}
              >
                <step.icon size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {i + 1}. {step.title}
                </div>
                <div className="text-muted" style={{ fontSize: 13 }}>{step.body}</div>
              </div>
            </div>
          ))}
        </div>

        <Link to="/checkin/demo" style={{ fontSize: 13 }}>
          See the customer view →
        </Link>
        <Link to="/card" style={{ fontSize: 13 }}>
          Check my punches
        </Link>

        <LegalLinks />
      </div>
    </div>
  );
}
