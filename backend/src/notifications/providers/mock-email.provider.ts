import { Injectable } from '@nestjs/common';
import type { NotificationMessage, NotificationProvider } from '../notification-provider';

@Injectable()
export class MockEmailProvider implements NotificationProvider {
  send(notification: NotificationMessage): void {
    console.info(`[mock-email] Would email user ${notification.userId}: ${notification.title}`);
  }
}
