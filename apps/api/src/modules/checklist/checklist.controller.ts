import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { AccessTokenPayload } from "../../common/types/jwt-payload";
import { ChecklistService } from "./checklist.service";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("inquirer")
@Controller("checklist")
export class ChecklistController {
  constructor(private readonly checklistService: ChecklistService) {}

  @Post("generate")
  generate(@CurrentUser() user: AccessTokenPayload) {
    return this.checklistService.generate(user.sub);
  }

  @Get()
  list(@CurrentUser() user: AccessTokenPayload) {
    return this.checklistService.list(user.sub);
  }

  @Get("budget")
  getBudgetSummary(@CurrentUser() user: AccessTokenPayload) {
    return this.checklistService.getBudgetSummary(user.sub);
  }

  @Post()
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateTaskDto) {
    return this.checklistService.create(user.sub, dto);
  }

  @Put(":id")
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.checklistService.update(user.sub, id, dto);
  }

  @HttpCode(204)
  @Delete(":id")
  async delete(@CurrentUser() user: AccessTokenPayload, @Param("id", ParseUUIDPipe) id: string) {
    await this.checklistService.delete(user.sub, id);
  }
}
