import type { EmailMessage, EmailPort } from '../data-access/email-port.js';

export function createInMemoryEmailPort() {
  const sent: EmailMessage[] = [];
  let failNext: string | null = null;

  return {
    port: {
      async send(message: EmailMessage) {
        if (failNext !== null) {
          const reason = failNext;
          failNext = null;
          return { outcome: 'failed', reason } as const;
        }
        sent.push(message);
        return { outcome: 'sent' } as const;
      },
    } satisfies EmailPort,

    /** Every message the port "sent", in order. */
    sent,

    /** Makes the next `send` call fail with this reason, once. */
    failNextSend(reason = 'forced failure') {
      failNext = reason;
    },
  };
}
