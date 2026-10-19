import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { NotificationsController } from './notifications.controller';
import { NOTIFICATION_PROVIDERS } from './notification-provider';
import { NotificationsService } from './notifications.service';
import { ConsoleNotificationProvider } from './providers/console-notification.provider';
import { MockEmailProvider } from './providers/mock-email.provider';
import { MockFirebaseProvider } from './providers/mock-firebase.provider';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [NotificationsController],
  providers: [
    ConsoleNotificationProvider,
    MockEmailProvider,
    MockFirebaseProvider,
    {
      provide: NOTIFICATION_PROVIDERS,
      useFactory: (
        consoleProvider: ConsoleNotificationProvider,
        emailProvider: MockEmailProvider,
        firebaseProvider: MockFirebaseProvider,
      ) => [consoleProvider, emailProvider, firebaseProvider],
      inject: [ConsoleNotificationProvider, MockEmailProvider, MockFirebaseProvider],
    },
    NotificationsService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
