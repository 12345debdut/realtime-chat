/**
 * Jest setup — mock native modules so repository tests can run in Node.js.
 */

// Mock react-native-mmkv
jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    getNumber: jest.fn(),
    setNumber: jest.fn(),
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    contains: jest.fn(() => false),
  })),
}));

// Mock react-native-keychain
jest.mock('react-native-keychain', () => ({
  setGenericPassword: jest.fn(),
  getGenericPassword: jest.fn(() => Promise.resolve(false)),
  resetGenericPassword: jest.fn(),
}));

// Mock logger
jest.mock('../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));
