import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Messages: undefined;
  Connections: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  ChatRoom: { roomId: string; title: string; isRequest?: boolean };
  NewChat: undefined;
  Profile: { userId?: string };
};
