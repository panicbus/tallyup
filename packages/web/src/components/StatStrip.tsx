interface StatStripProps {
  checkins: number;
  newCustomers: number;
  rewards: number;
  windowDays: number;
}

/** The dashboard's headline numbers for the trailing window. */
export function StatStrip({ checkins, newCustomers, rewards, windowDays }: StatStripProps) {
  const items = [
    { id: 'checkins', value: checkins, label: checkins === 1 ? 'check-in' : 'check-ins' },
    { id: 'new', value: newCustomers, label: newCustomers === 1 ? 'new customer' : 'new customers' },
    { id: 'rewards', value: rewards, label: rewards === 1 ? 'reward given' : 'rewards given' },
  ];

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--color-neutral-500)', marginBottom: 6 }}>Past {windowDays} days</div>
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
        {items.map((item) => (
          <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span
              style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 22, color: 'var(--color-text)' }}
            >
              {item.value}
            </span>
            <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
