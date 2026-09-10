import { LegalPage } from '../components/LegalPage';

export function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="September 2026">

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>From shop owners and staff:</strong> your email address, and the business details you enter (name,
          reward, logo).
        </li>
        <li>
          <strong>From customers:</strong> the phone number they type at check-in, their visit count and rewards, and
          (only if they tick the box) a record that they agreed to receive texts, with the date and the exact
          wording they saw.
        </li>
      </ul>

      <h2>How we use it</h2>
      <p>
        To run the punch card: showing your staff the check-in queue, tracking points, and letting you see and export
        your own customer list. Phone numbers are shown to staff in masked form (last four digits) everywhere except
        the moment of check-in.
      </p>

      <h2>What we don't do</h2>
      <ul>
        <li>We don't sell customer data or share it with other businesses.</li>
        <li>We don't text your customers yet. Consent is collected now so that feature is possible later; nothing is
          sent until it exists, and every message will include a way to opt out.</li>
      </ul>

      <h2>Where it lives</h2>
      <p>
        Data is stored with our hosting provider (Supabase, on infrastructure in the United States). Access is
        restricted to the TallyUp team and your own staff accounts.
      </p>

      <h2>Deleting your data</h2>
      <p>
        Ask us to delete your business and we'll remove it and its customer records. A customer who wants their number
        removed can ask you, and you can remove them from your roster.
      </p>

      <h2>Contact</h2>
      <p>Privacy questions: reach out to the person who invited you to the pilot.</p>
    </LegalPage>
  );
}
