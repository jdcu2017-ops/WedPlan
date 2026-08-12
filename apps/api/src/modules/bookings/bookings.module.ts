import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { InquiriesModule } from "../inquiries/inquiries.module";
import { BookingsController } from "./bookings.controller";
import { BookingsRepository } from "./bookings.repository";
import { BookingsService } from "./bookings.service";
import { HoldExpiryJob } from "./hold-expiry.job";
import { QuotesController } from "./quotes.controller";
import { QuotesRepository } from "./quotes.repository";
import { QuotesService } from "./quotes.service";

@Module({
  imports: [AuthModule, InquiriesModule],
  controllers: [QuotesController, BookingsController],
  providers: [
    QuotesService,
    QuotesRepository,
    BookingsService,
    BookingsRepository,
    HoldExpiryJob,
  ],
})
export class BookingsModule {}
