import { Injectable } from '@nestjs/common';
import type { NotificationMessage, NotificationProvider } from '../notification-provider';

@Injectable()
export class ConsoleNotificationProvider implements NotificationProvider {
  send(notification: NotificationMessage): void {
    console.info(`[notification] ${notification.title}: ${notification.message} (user ${notification.userId})`);
  }
}
