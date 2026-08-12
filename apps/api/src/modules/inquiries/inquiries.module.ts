import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { InquiriesController } from "./inquiries.controller";
import { InquiriesRepository } from "./inquiries.repository";
import { InquiriesService } from "./inquiries.service";

@Module({
  imports: [AuthModule],
  controllers: [InquiriesController],
  providers: [InquiriesService, InquiriesRepository],
  // Exported so the bookings module (quotes -> accept -> booking) can read/
  // transition inquiry rows without duplicating these queries.
  exports: [InquiriesRepository],
})
export class InquiriesModule {}
