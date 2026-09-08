import { test } from 'vitest';
import { runStaffPortContractTests } from './staff-port-contract.js';
import { createInMemoryStaffPort } from './in-memory-staff-port.js';

runStaffPortContractTests(test, async () => createInMemoryStaffPort());
