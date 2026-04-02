import { defineConfig } from '@playwright/test';

const chromiumOptions = {
  launchOptions: {
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
    ],
  },
};

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: { timeout: 5000 },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium', ...chromiumOptions },
      testMatch: /e2e\.spec\.mjs/,
    },
    {
      // WebKit only runs the camera-free filter tests
      name: 'webkit',
      use: { browserName: 'webkit' },
      grep: /Filter effects/,
      testMatch: /e2e\.spec\.mjs/,
    },
  ],
});
