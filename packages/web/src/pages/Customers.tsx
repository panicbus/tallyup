import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Download, Users } from 'lucide-react';
import { exportCustomersCsv, getCustomers, getMe } from '../lib/api';
import type { CustomerSortField, MeResponse, RosterPage, SortDirection } from '../lib/api';
import { supabaseClient } from '../lib/supabase';
import { StaffHeader } from '../components/StaffHeader';
import { RosterTable } from '../components/RosterTable';
import { RosterCardList } from '../components/RosterCardList';

export function Customers() {
  const { slug } = useParams() as { slug: string };
  const navigate = useNavigate();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<CustomerSortField>('joined');
  const [dir, setDir] = useState<SortDirection>('desc');
  const [data, setData] = useState<RosterPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    getMe().then((result) => {
      if (!result) {
        navigate('/login');
        return;
      }
      if (result.business.slug !== slug) {
        navigate(`/dashboard/${result.business.slug}/customers`);
        return;
      }
      setMe(result);
    });
  }, [slug, navigate]);

  useEffect(() => {
    if (!me) return;
    let cancelled = false;

    getCustomers(slug, { page, sort, dir })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load customers.');
      });

    return () => {
      cancelled = true;
    };
  }, [slug, me, page, sort, dir]);

  function toggleSort(field: CustomerSortField) {
    setPage(1);
    if (sort === field) {
      setDir((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(field);
      setDir('desc');
    }
  }

  async function handleSignOut() {
    await supabaseClient.auth.signOut();
    navigate('/login');
  }

  async function handleExportCsv() {
    setExporting(true);
    setError(null);
    try {
      const blob = await exportCustomersCsv(slug);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${slug}-customers.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setError('Could not export customers.');
    } finally {
      setExporting(false);
    }
  }

  if (!me) {
    return (
      <div className="page">
        <div className="page-content" style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <p className="text-muted">Loading…</p>
        </div>
      </div>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="page">
      <div className="app-shell" style={{ width: '100%', maxWidth: 'var(--page-max-width)' }}>
        <StaffHeader
          slug={slug}
          businessName={me.business.name}
          logoUrl={me.business.logoUrl}
          userEmail={me.email}
          userRole={me.role}
          onSignOut={handleSignOut}
          showStaffTab={me.role === 'owner'}
        />

        <div className="page-content app-content" style={{ paddingTop: 24, gap: 16, maxWidth: 'none' }}>
          {error && (
            <p role="alert" style={{ color: 'var(--color-accent-700)' }}>
              {error}
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ margin: 0 }}>Customers</h3>
            {data && <span className="tag tag-neutral">{data.total}</span>}
            {me.role === 'owner' && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginLeft: 'auto', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
                disabled={exporting}
                onClick={handleExportCsv}
              >
                <Download size={14} /> {exporting ? 'Exporting…' : 'Download CSV'}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <SortButton label="Joined" active={sort === 'joined'} dir={dir} onClick={() => toggleSort('joined')} />
            <SortButton label="Current points" active={sort === 'points'} dir={dir} onClick={() => toggleSort('points')} />
          </div>

          {data && data.items.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: '40px 10px',
                color: 'var(--color-neutral-600)',
              }}
            >
              <Users size={28} />
              <p style={{ margin: 0, fontSize: 14 }}>No customers yet. They'll show up here after their first check-in.</p>
            </div>
          ) : (
            data && (
              <>
                <RosterTable items={data.items} />
                <RosterCardList items={data.items} />
              </>
            )
          )}

          {data && data.total > data.pageSize && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                Previous
              </button>
              <span className="text-muted" style={{ fontSize: 13 }}>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SortButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDirection;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? 'tag tag-accent' : 'tag tag-neutral'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', cursor: 'pointer' }}
    >
      {label}
      {active && (dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
    </button>
  );
}
