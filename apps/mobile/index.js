/**
 * @format
 * Entry point — must import gesture-handler first, then keyboard-controller
 * for native initialization order.
 */

import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';

import App from './src/app/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
