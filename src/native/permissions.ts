import {PermissionsAndroid, Platform} from 'react-native';

/**
 * マイク権限のダイアログは22:50に出してはいけない（09章 受け入れ基準）。
 * 初回起動時にまとめて取得しておく。
 */
export async function requestStartupPermissions(): Promise<void> {
  if (Platform.OS !== 'android') {return;}

  const permissions: string[] = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  if (Platform.Version >= 33) {
    permissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }

  await PermissionsAndroid.requestMultiple(permissions as never[]);
}
