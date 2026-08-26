-- Runs once when the postgres container's data volume is first created.
-- POSTGRES_DB (see docker-compose.yml) provisions the dev database; this
-- provisions a separate database for the integration test suite so test
-- runs never touch dev data.
CREATE DATABASE tallyup_test;
