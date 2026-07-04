// push.js — notification registration. Requests permission, gets the device's
// Expo push token, and hands it up so the engine can reach this device. The
// actual sending (follow-ups, buzzes) rides the engine's scheduled_pings clock
// + the safety seatbelt — this file only wires the ADDRESS + CONSENT.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// this app's EAS projectId (from app.json) — needed to mint an Expo push token
const EAS_PROJECT_ID = 'bd44ffeb-cc65-415f-969e-ffdf8dfff068';

// show notifications while the app is foregrounded, too
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true,
  }),
});

// returns { granted, token } — token is the Expo push token (or null).
export async function registerForPush() {
  try {
    // permission
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return { granted: false, token: null };

    // android channel (required for the notification to show)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const tokenResp = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
    return { granted: true, token: tokenResp?.data || null };
  } catch (e) {
    return { granted: false, token: null };
  }
}

// just check current permission without prompting
export async function pushPermission() {
  try { const { status } = await Notifications.getPermissionsAsync(); return status; }
  catch (e) { return 'undetermined'; }
}
