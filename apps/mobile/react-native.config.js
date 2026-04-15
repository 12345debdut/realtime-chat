/**
 * React Native CLI configuration.
 *
 * react-native-vector-icons v10's RNVectorIcons.podspec declares
 *   s.resources = "Fonts/*.ttf"
 * which means ALL 19 font families are bundled into mobile.app by
 * CocoaPods unconditionally. There is no app-level config to filter
 * them — the pod is the single source of truth for font copying.
 *
 * We keep this file minimal so it's just the default project config.
 * Runtime font registration still happens via UIAppFonts in
 * ios/mobile/Info.plist, which we add manually for the families we use.
 *
 * If we ever need to trim the bundle (each family is ~100–900 KB, so all
 * 19 add up to ~10 MB of waste for a chat app that uses 2–3), the right
 * move is to fork the podspec in a Podfile post_install hook and override
 * s.resources with only the fonts we want.
 */
module.exports = {
  project: {
    ios: {},
    android: {},
  },
  assets: ['./assets/fonts/'],
};
