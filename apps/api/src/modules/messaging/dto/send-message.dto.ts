import { Type } from "class-transformer";
import { IsArray, IsOptional, IsString, IsUrl, MaxLength, ValidateNested } from "class-validator";

export class MessageAttachmentDto {
  @IsUrl()
  fileUrl!: string;

  @IsString()
  fileName!: string;

  @IsOptional()
  @IsString()
  contentType?: string;
}

export class SendMessageDto {
  @IsString()
  @MaxLength(5000)
  body!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageAttachmentDto)
  attachments?: MessageAttachmentDto[];
}
