module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./src/__tests__/setup.ts'],
  testMatch: ['**/src/__tests__/**/*.test.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(@nozbe/watermelondb|@react-native|react-native|@rtc/contracts)/)',
  ],
};
