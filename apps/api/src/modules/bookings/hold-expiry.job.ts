import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { BookingsRepository } from "./bookings.repository";

// Spec 3.4 / Phase 4: tentative holds auto-expire (48-72hr window) if the
// deposit never arrives. This is the sweep that reclaims those dates.
@Injectable()
export class HoldExpiryJob {
  private readonly logger = new Logger(HoldExpiryJob.name);

  constructor(private readonly bookingsRepo: BookingsRepository) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async sweep(): Promise<void> {
    const count = await this.bookingsRepo.sweepExpiredHolds();
    if (count > 0) {
      this.logger.log(`Released ${count} expired hold(s) back to open`);
    }
  }
}
