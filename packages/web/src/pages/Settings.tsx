import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getMe, updateBusiness } from '../lib/api';
import type { MeResponse } from '../lib/api';
import { SettingsForm, type SettingsFormValues } from '../components/SettingsForm';

export function Settings() {
  const { slug } = useParams() as { slug: string };
  const navigate = useNavigate();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getMe().then((result) => {
      if (!result) {
        navigate('/login');
        return;
      }
      if (result.business.slug !== slug) {
        navigate(`/dashboard/${result.business.slug}/settings`);
        return;
      }
      setMe(result);
    });
  }, [slug, navigate]);

  async function handleSubmit(values: SettingsFormValues) {
    setSubmitting(true);
    setError(undefined);
    setSaved(false);

    try {
      const updated = await updateBusiness(slug, values);
      setMe((current) => (current ? { ...current, business: updated } : current));
      setSaved(true);
    } catch {
      setError('Could not save changes.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!me) {
    return (
      <main>
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Business settings</h1>
      <p>
        <Link to={`/dashboard/${slug}`}>Back to dashboard</Link>
      </p>
      {saved && <p role="status">Saved.</p>}
      <SettingsForm business={me.business} onSubmit={handleSubmit} submitting={submitting} error={error} />
    </main>
  );
}
