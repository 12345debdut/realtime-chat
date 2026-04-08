import { Platform } from 'react-native';

/**
 * API + socket endpoints.
 *
 * Set `RTC_ENV=prod` in your shell (or Metro command) to hit the deployed
 * Fly.io backend. Defaults to localhost for dev:
 *   - iOS simulator → `localhost` reaches the host machine
 *   - Android emulator → `10.0.2.2` is the host alias
 */
const ENV = (process.env['RTC_ENV'] ?? 'dev') as 'dev' | 'prod';

const LOCAL_HOST = Platform.select({ ios: 'localhost', android: '10.0.2.2' }) ?? 'localhost';

const DEV_URL = `http://${LOCAL_HOST}:4000`;
const PROD_URL = 'https://rtc-chat.fly.dev';

const BASE = ENV === 'prod' ? PROD_URL : DEV_URL;

export const API_URL = BASE;
export const SOCKET_URL = BASE;
