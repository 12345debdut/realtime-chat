module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // WatermelonDB models use legacy-style decorators.
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    // Reanimated 4.x uses react-native-worklets instead of its own Babel
    // plugin. The worklets plugin MUST be listed last.
    'react-native-worklets/plugin',
  ],
};
