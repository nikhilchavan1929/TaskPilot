import { Injectable } from '@nestjs/common';
import type { NotificationMessage, NotificationProvider } from '../notification-provider';

@Injectable()
export class MockFirebaseProvider implements NotificationProvider {
  send(notification: NotificationMessage): void {
    console.info(`[mock-firebase] Would notify user ${notification.userId}: ${notification.title}`);
  }
}
