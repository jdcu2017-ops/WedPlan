import { BadRequestException } from "@nestjs/common";

const MAX_RANGE_DAYS = 366;

// Shared by the public and self-service availability endpoints so both reject
// the same malformed/oversized ranges.
export function assertValidDateRange(from: string, to: string): void {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (toDate < fromDate) {
    throw new BadRequestException("`to` must not be before `from`");
  }
  const days = (toDate.getTime() - fromDate.getTime()) / 86_400_000;
  if (days > MAX_RANGE_DAYS) {
    throw new BadRequestException(`Range cannot exceed ${MAX_RANGE_DAYS} days`);
  }
}
