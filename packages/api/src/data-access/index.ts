// Data-access (Postgres, via Kysely) lands here starting W1, exposed as a
// narrow port interface with coarse transactional operations (e.g.
// confirmCheckin, redeem) rather than fine-grained CRUD. Services depend on
// this port; unit tests substitute an in-memory fake of it.
export {};
