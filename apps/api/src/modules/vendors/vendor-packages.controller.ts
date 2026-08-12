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
import { CreatePackageAddonDto } from "./dto/create-package-addon.dto";
import { UpsertVendorPackageDto } from "./dto/upsert-vendor-package.dto";
import { VendorPackagesService } from "./vendor-packages.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("vendor")
@Controller("vendors/me/packages")
export class VendorPackagesController {
  constructor(private readonly packagesService: VendorPackagesService) {}

  @Get()
  list(@CurrentUser() user: AccessTokenPayload) {
    return this.packagesService.listOwn(user.sub);
  }

  @Post()
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: UpsertVendorPackageDto) {
    return this.packagesService.create(user.sub, dto);
  }

  @Put(":id")
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpsertVendorPackageDto,
  ) {
    return this.packagesService.update(user.sub, id, dto);
  }

  @HttpCode(204)
  @Delete(":id")
  async delete(@CurrentUser() user: AccessTokenPayload, @Param("id", ParseUUIDPipe) id: string) {
    await this.packagesService.delete(user.sub, id);
  }

  @Post(":id/addons")
  addAddon(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreatePackageAddonDto,
  ) {
    return this.packagesService.addAddon(user.sub, id, dto);
  }

  @HttpCode(204)
  @Delete(":id/addons/:addonId")
  async removeAddon(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("addonId", ParseUUIDPipe) addonId: string,
  ) {
    await this.packagesService.removeAddon(user.sub, id, addonId);
  }
}
