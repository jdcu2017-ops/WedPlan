import { IsIn, IsOptional } from "class-validator";
import type { InquiryStatus } from "@wedplan/shared";

const INQUIRY_STATUSES: InquiryStatus[] = ["open", "quoted", "hold", "contracted", "declined", "closed"];

export class ListInquiriesQueryDto {
  @IsOptional()
  @IsIn(INQUIRY_STATUSES)
  status?: InquiryStatus;
}
