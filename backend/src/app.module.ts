import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health.controller';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
    DatabaseModule,
    AuthModule,
    TasksModule,
    UsersModule,
    RolesModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
