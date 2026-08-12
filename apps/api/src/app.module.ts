import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import configuration from "./config/configuration";
import { AuditLogModule } from "./common/audit/audit-log.module";
import { DatabaseModule } from "./database/database.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BookingsModule } from "./modules/bookings/bookings.module";
import { ChecklistModule } from "./modules/checklist/checklist.module";
import { InquiriesModule } from "./modules/inquiries/inquiries.module";
import { MessagingModule } from "./modules/messaging/messaging.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { UsersModule } from "./modules/users/users.module";
import { VendorsModule } from "./modules/vendors/vendors.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env"],
      load: [configuration],
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuditLogModule,
    AuthModule,
    UsersModule,
    VendorsModule,
    InquiriesModule,
    MessagingModule,
    BookingsModule,
    PaymentsModule,
    ChecklistModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
