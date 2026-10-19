export interface NotificationMessage {
  userId: string;
  title: string;
  message: string;
}

export interface NotificationProvider {
  send(notification: NotificationMessage): Promise<void> | void;
}

export const NOTIFICATION_PROVIDERS = Symbol('NOTIFICATION_PROVIDERS');
