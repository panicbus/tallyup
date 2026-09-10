/** One transactional email. `html` is the rendered body; `text` is the
 * plain-text alternative every real client expects alongside it. */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type SendEmailResult =
  | { outcome: 'sent' }
  // Every provider-side failure -- bad key, 4xx/5xx, network, timeout --
  // collapses to this. `reason` is for the api's own logs, never shown to a
  // user. The caller compensates (revokes the just-created invite); it does
  // not decode why.
  | { outcome: 'failed'; reason: string };

/** Swappable outbound-email boundary, same fake/real split as AuthPort.
 * Vendor errors are translated to SendEmailResult here and never escape;
 * no vendor type crosses this line. */
export interface EmailPort {
  send(message: EmailMessage): Promise<SendEmailResult>;
}
