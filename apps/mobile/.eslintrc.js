module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // Inline styles are a deliberate pattern here — theme-aware values (colors,
    // spacing) need to be read from context and live next to the JSX that uses
    // them. Off is a more honest default than drowning in warnings.
    'react-native/no-inline-styles': 'off',
  },
};
