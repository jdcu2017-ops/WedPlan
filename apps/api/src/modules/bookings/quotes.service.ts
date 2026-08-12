import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InquiriesRepository } from "../inquiries/inquiries.repository";
import { CreateQuoteDto } from "./dto/create-quote.dto";
import { QuoteRow, QuotesRepository } from "./quotes.repository";

@Injectable()
export class QuotesService {
  constructor(
    private readonly quotesRepo: QuotesRepository,
    private readonly inquiriesRepo: InquiriesRepository,
  ) {}

  async create(vendorId: string, inquiryId: string, dto: CreateQuoteDto) {
    const inquiry = await this.getQuotableInquiry(vendorId, inquiryId);
    const totalAmount = this.computeTotal(dto);
    this.assertDepositWithinTotal(dto.depositAmount, totalAmount);

    const row = await this.quotesRepo.create(
      inquiry.id,
      dto.lineItems,
      totalAmount,
      dto.depositAmount,
      dto.validUntil ?? null,
    );
    return this.toDto(row);
  }

  async update(vendorId: string, quoteId: string, dto: CreateQuoteDto) {
    const { quote } = await this.getOwnedQuote(vendorId, quoteId);
    if (quote.status !== "draft") {
      throw new ConflictException("Only draft quotes can be edited");
    }
    const totalAmount = this.computeTotal(dto);
    this.assertDepositWithinTotal(dto.depositAmount, totalAmount);

    const updated = await this.quotesRepo.update(
      quoteId,
      dto.lineItems,
      totalAmount,
      dto.depositAmount,
      dto.validUntil ?? null,
    );
    if (!updated) {
      throw new ConflictException("Quote status changed concurrently, please retry");
    }
    return this.toDto(updated);
  }

  async send(vendorId: string, quoteId: string) {
    const { quote, inquiry } = await this.getOwnedQuote(vendorId, quoteId);
    if (quote.status !== "draft") {
      throw new ConflictException("Only draft quotes can be sent");
    }
    if (inquiry.status !== "open" && inquiry.status !== "quoted") {
      throw new ConflictException("Cannot send a quote once the inquiry is on hold or closed");
    }
    const updated = await this.quotesRepo.transitionStatus(quoteId, ["draft"], "sent");
    if (!updated) {
      throw new ConflictException("Quote status changed concurrently, please retry");
    }
    // Best-effort: the inquiry's status is informational (the quote's own
    // status is the authoritative gate for accept/decline), so this isn't
    // wrapped in a transaction with the quote update above.
    await this.inquiriesRepo.transitionStatus(inquiry.id, ["open", "quoted"], "quoted");
    return this.toDto(updated);
  }

  async decline(inquirerId: string, quoteId: string) {
    const quote = await this.quotesRepo.findById(quoteId);
    if (!quote) {
      throw new NotFoundException("Quote not found");
    }
    const inquiry = await this.inquiriesRepo.findById(quote.inquiry_id);
    if (!inquiry) {
      throw new NotFoundException("Inquiry not found");
    }
    if (inquiry.inquirer_id !== inquirerId) {
      throw new ForbiddenException("Not your inquiry");
    }
    if (quote.status !== "sent") {
      throw new ConflictException("Only sent quotes can be declined");
    }
    const updated = await this.quotesRepo.transitionStatus(quoteId, ["sent"], "declined");
    if (!updated) {
      throw new ConflictException("Quote status changed concurrently, please retry");
    }
    await this.inquiriesRepo.transitionStatus(inquiry.id, ["quoted"], "open");
    return this.toDto(updated);
  }

  async listForInquiry(userId: string, inquiryId: string) {
    const inquiry = await this.inquiriesRepo.findById(inquiryId);
    if (!inquiry) {
      throw new NotFoundException("Inquiry not found");
    }
    if (inquiry.inquirer_id !== userId && inquiry.vendor_id !== userId) {
      throw new ForbiddenException("Not a participant in this inquiry");
    }
    const rows = await this.quotesRepo.listForInquiry(inquiryId);
    return rows.map((r) => this.toDto(r));
  }

  private async getQuotableInquiry(vendorId: string, inquiryId: string) {
    const inquiry = await this.inquiriesRepo.findById(inquiryId);
    if (!inquiry) {
      throw new NotFoundException("Inquiry not found");
    }
    if (inquiry.vendor_id !== vendorId) {
      throw new ForbiddenException("Not your inquiry");
    }
    if (inquiry.status !== "open" && inquiry.status !== "quoted") {
      throw new ConflictException("Cannot quote an inquiry that is on hold, contracted, or closed");
    }
    if (!inquiry.event_date) {
      throw new BadRequestException(
        "The inquiry needs an event date before a quote can be created",
      );
    }
    return inquiry;
  }

  private async getOwnedQuote(vendorId: string, quoteId: string) {
    const quote = await this.quotesRepo.findById(quoteId);
    if (!quote) {
      throw new NotFoundException("Quote not found");
    }
    const inquiry = await this.inquiriesRepo.findById(quote.inquiry_id);
    if (!inquiry || inquiry.vendor_id !== vendorId) {
      throw new ForbiddenException("Not your quote");
    }
    return { quote, inquiry };
  }

  private computeTotal(dto: CreateQuoteDto): number {
    return dto.lineItems.reduce((sum, item) => sum + item.amount, 0);
  }

  private assertDepositWithinTotal(depositAmount: number, totalAmount: number): void {
    if (depositAmount > totalAmount) {
      throw new BadRequestException("Deposit amount cannot exceed the quote total");
    }
  }

  private toDto(row: QuoteRow) {
    return {
      id: row.id,
      inquiryId: row.inquiry_id,
      lineItems: row.line_items,
      totalAmount: Number(row.total_amount),
      depositAmount: Number(row.deposit_amount),
      validUntil: row.valid_until,
      status: row.status,
      createdAt: row.created_at,
    };
  }
}
