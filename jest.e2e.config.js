export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  roots: ['<rootDir>/test/e2e'],
  testMatch: [
    '**/e2e/**/*.test.ts'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'ESNext',
        target: 'ES2022',
        moduleResolution: 'bundler',
        allowSyntheticDefaultImports: true,
        esModuleInterop: true
      }
    }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(supertest|express)/)'
  ],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  verbose: true,
  testTimeout: 30000, // 30 seconds for E2E tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  // Don't collect coverage for E2E tests
  collectCoverage: false
};
