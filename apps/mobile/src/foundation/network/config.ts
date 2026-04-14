import { Platform } from 'react-native';

/**
 * API + socket endpoints.
 *
 * IMPORTANT: React Native's Metro does NOT automatically expose shell
 * environment variables to the bundle — only `process.env.NODE_ENV` is
 * inlined. That means reading `process.env.RTC_ENV` at runtime always
 * returns undefined unless you integrate `react-native-config` or a babel
 * env plugin. For a single-target demo we just flip the constant directly.
 *
 * Toggle USE_PROD to switch between the deployed Fly backend and a
 * locally-running server during development:
 *   - iOS simulator → `localhost` reaches the host machine
 *   - Android emulator → `10.0.2.2` is the host alias
 */
const USE_PROD = true;

const LOCAL_HOST = Platform.select({ ios: 'localhost', android: '10.0.2.2' }) ?? 'localhost';

const DEV_URL = `http://${LOCAL_HOST}:4000`;
const PROD_URL = 'https://rtc-chat.fly.dev';

const BASE = USE_PROD ? PROD_URL : DEV_URL;

export const API_URL = BASE;
export const SOCKET_URL = BASE;
