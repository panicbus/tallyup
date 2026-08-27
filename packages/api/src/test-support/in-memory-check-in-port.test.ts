import { test } from 'vitest';
import { runCheckInPortContractTests } from './check-in-port-contract.js';
import { createInMemoryCheckInPort } from './in-memory-check-in-port.js';

runCheckInPortContractTests(test, async () => createInMemoryCheckInPort());
