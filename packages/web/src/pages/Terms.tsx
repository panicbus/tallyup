import { LegalPage } from '../components/LegalPage';

export function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="September 2026">
      <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
        A plain-language summary for the pilot. It will be replaced by a lawyer-reviewed version before general
        release.
      </p>

      <h2>What TallyUp is</h2>
      <p>
        TallyUp is a digital punch card. Your customers scan a QR code and enter their phone number; your staff
        confirm each visit; customers earn a reward you define. That's the whole product today.
      </p>

      <h2>Using it</h2>
      <ul>
        <li>You're responsible for what your staff do with their accounts. Keep invite codes and passwords private.</li>
        <li>Don't use TallyUp to send spam, harass anyone, or break the law.</li>
        <li>Only collect phone numbers from customers who chose to give them at your counter.</li>
      </ul>

      <h2>Your data</h2>
      <p>
        Your business's customer list, visits, and rewards belong to you. You can export them to CSV at any time from
        the Customers page. Ask us to delete your business and we will remove it and its customer data.
      </p>

      <h2>The pilot</h2>
      <p>
        TallyUp is early software offered free during the pilot. It's provided "as is," it may change or have gaps,
        and we can't promise it will never be unavailable. If we ever start charging, we'll tell you first and you can
        walk away.
      </p>

      <h2>Contact</h2>
      <p>Questions about these terms: reach out to the person who invited you to the pilot.</p>
    </LegalPage>
  );
}
