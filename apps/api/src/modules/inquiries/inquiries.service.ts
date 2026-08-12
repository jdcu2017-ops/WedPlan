import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { InquiryStatus } from "@wedplan/shared";
import { CreateInquiryDto } from "./dto/create-inquiry.dto";
import { InquiriesRepository, InquiryRow } from "./inquiries.repository";

@Injectable()
export class InquiriesService {
  constructor(private readonly repo: InquiriesRepository) {}

  async create(inquirerId: string, dto: CreateInquiryDto) {
    const [inquirerReady, vendorExists] = await Promise.all([
      this.repo.inquirerProfileExists(inquirerId),
      this.repo.vendorExists(dto.vendorId),
    ]);
    if (!inquirerReady) {
      throw new BadRequestException("Complete your inquirer profile before sending inquiries");
    }
    if (!vendorExists) {
      throw new BadRequestException("Vendor not found");
    }

    const row = await this.repo.create(inquirerId, dto);
    return this.toDto(row);
  }

  async listForUser(userId: string, role: "inquirer" | "vendor", status?: InquiryStatus) {
    const column = role === "inquirer" ? "inquirer_id" : "vendor_id";
    const rows = await this.repo.listForParticipant(userId, column, status);
    return rows.map((r) => this.toDto(r));
  }

  async getForParticipant(userId: string, inquiryId: string) {
    const row = await this.getOwnedRow(inquiryId, userId);
    return this.toDto(row);
  }

  async decline(vendorId: string, inquiryId: string) {
    const row = await this.repo.findById(inquiryId);
    if (!row) {
      throw new NotFoundException("Inquiry not found");
    }
    if (row.vendor_id !== vendorId) {
      throw new ForbiddenException("Not your inquiry");
    }
    if (row.status !== "open") {
      throw new ConflictException("Only open inquiries can be declined");
    }
    const updated = await this.repo.transitionStatus(inquiryId, ["open"], "declined");
    if (!updated) {
      throw new ConflictException("Inquiry status changed concurrently, please retry");
    }
    return this.toDto(updated);
  }

  async setEventDate(inquirerId: string, inquiryId: string, eventDate: string) {
    const row = await this.repo.findById(inquiryId);
    if (!row) {
      throw new NotFoundException("Inquiry not found");
    }
    if (row.inquirer_id !== inquirerId) {
      throw new ForbiddenException("Not your inquiry");
    }
    if (row.status !== "open" && row.status !== "quoted") {
      throw new ConflictException(
        "Event date can only be changed before a booking is in progress",
      );
    }
    const updated = await this.repo.updateEventDate(inquiryId, eventDate);
    if (!updated) {
      throw new ConflictException("Inquiry status changed concurrently, please retry");
    }
    return this.toDto(updated);
  }

  async close(userId: string, inquiryId: string) {
    const row = await this.getOwnedRow(inquiryId, userId);
    const closableFrom: InquiryStatus[] = ["open", "quoted", "hold"];
    if (!closableFrom.includes(row.status)) {
      throw new ConflictException("Inquiry is already closed or declined");
    }
    const updated = await this.repo.transitionStatus(inquiryId, closableFrom, "closed");
    if (!updated) {
      throw new ConflictException("Inquiry status changed concurrently, please retry");
    }
    return this.toDto(updated);
  }

  private async getOwnedRow(inquiryId: string, userId: string): Promise<InquiryRow> {
    const row = await this.repo.findById(inquiryId);
    if (!row) {
      throw new NotFoundException("Inquiry not found");
    }
    if (row.inquirer_id !== userId && row.vendor_id !== userId) {
      throw new ForbiddenException("Not a participant in this inquiry");
    }
    return row;
  }

  private toDto(row: InquiryRow) {
    return {
      id: row.id,
      inquirerId: row.inquirer_id,
      vendorId: row.vendor_id,
      vendorBusinessName: row.vendor_business_name,
      inquirerDisplayName: row.inquirer_display_name,
      category: row.category,
      eventDate: row.event_date,
      status: row.status,
      createdAt: row.created_at,
      conversationId: row.conversation_id,
    };
  }
}
