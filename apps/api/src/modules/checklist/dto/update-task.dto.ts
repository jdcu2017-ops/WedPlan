import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import type { TaskStatus } from "@wedplan/shared";

const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "done"];

export class UpdateTaskDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsIn(TASK_STATUSES)
  status!: TaskStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  assignee?: string;
}
