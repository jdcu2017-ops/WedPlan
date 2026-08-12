import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ChecklistController } from "./checklist.controller";
import { ChecklistRepository } from "./checklist.repository";
import { ChecklistService } from "./checklist.service";

@Module({
  imports: [AuthModule],
  controllers: [ChecklistController],
  providers: [ChecklistService, ChecklistRepository],
})
export class ChecklistModule {}
