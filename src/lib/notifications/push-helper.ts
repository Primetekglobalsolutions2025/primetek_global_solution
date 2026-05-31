/**
2:  * Client-side Push Notification Utilities
3:  * Handles VAPID key conversion, browser registration, and sync with subscription APIs.
4:  */

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function getNotificationPermissionState(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

export async function getActiveSubscription(): Promise<PushSubscription | null> {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return null;
  }

  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/**
 * Request notification permissions and register subscription on the server.
 */
export async function subscribeUserToPush(): Promise<{ success: boolean; error?: string }> {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return { success: false, error: 'Push notifications are not supported on this browser.' };
  }

  try {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.warn('VAPID Public Key missing on client side. Subscribing in mock mode.');
      return { success: true };
    }

    const reg = await navigator.serviceWorker.ready;
    const existingSub = await reg.pushManager.getSubscription();

    if (existingSub) {
      // Refresh sub on server
      await syncSubscriptionWithServer(existingSub);
      return { success: true };
    }

    // Call native permission request
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Notification permission was denied.' };
    }

    const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedKey as any
    });

    await syncSubscriptionWithServer(sub);
    return { success: true };
  } catch (err: any) {
    console.error('Error subscribing user to push notifications:', err);
    return { success: false, error: err.message || 'Failed to subscribe to push notifications.' };
  }
}

/**
 * Unsubscribe user from browser PushManager and the server.
 */
export async function unsubscribeUserFromPush(): Promise<{ success: boolean; error?: string }> {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return { success: false, error: 'Push notifications are not supported.' };
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();

    if (!sub) return { success: true };

    // Call server to remove endpoint first
    await fetch('/api/notifications/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint })
    });

    // Unsubscribe from browser manager
    await sub.unsubscribe();
    return { success: true };
  } catch (err: any) {
    console.error('Error unsubscribing user:', err);
    return { success: false, error: err.message || 'Failed to unsubscribe.' };
  }
}

async function syncSubscriptionWithServer(sub: PushSubscription) {
  // Parse device/browser info
  const ua = navigator.userAgent;
  let browserType = 'Unknown';
  if (ua.includes('Chrome') && !ua.includes('Edg')) {
    browserType = 'Chrome';
  } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
    browserType = 'Safari';
  } else if (ua.includes('Firefox')) {
    browserType = 'Firefox';
  } else if (ua.includes('Edg')) {
    browserType = 'Edge';
  }

  let deviceName = 'Desktop';
  if (ua.includes('Android')) {
    deviceName = 'Android Mobile';
  } else if (ua.includes('iPhone') || ua.includes('iPad')) {
    deviceName = 'iOS Device';
  }

  const p256dh = sub.getKey('p256dh');
  const auth = sub.getKey('auth');

  if (!p256dh || !auth) {
    throw new Error('Key exchange buffers are missing from subscription data.');
  }

  const payload = {
    subscription: {
      endpoint: sub.endpoint,
      keys: {
        p256dh: btoa(String.fromCharCode(...new Uint8Array(p256dh))),
        auth: btoa(String.fromCharCode(...new Uint8Array(auth)))
      }
    },
    deviceName,
    browserType
  };

  const res = await fetch('/api/notifications/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`Server returned subscription sync error: ${res.statusText}`);
  }
}
