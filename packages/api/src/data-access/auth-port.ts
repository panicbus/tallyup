/** What we trust about a caller once their token has been verified — not
 * yet tied to a business, since not every verified caller is staff. */
export interface AuthIdentity {
  userId: string;
  email: string;
}

export interface AuthPort {
  /** Null for a missing, expired, or otherwise invalid token — deliberately
   * collapsed into one reason, mirroring CheckInPort's not_found/not_eligible
   * results (routes decode WHY only when they need to; here they never do). */
  verifyToken(token: string): Promise<AuthIdentity | null>;
}
