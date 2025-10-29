import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { config } from 'dotenv';

// Load environment variables for testing
config();

expect.extend(matchers);

afterEach(() => {
  cleanup();
});
