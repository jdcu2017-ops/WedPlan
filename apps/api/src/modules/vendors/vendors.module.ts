import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { VendorAvailabilityController } from "./vendor-availability.controller";
import { VendorAvailabilityRepository } from "./vendor-availability.repository";
import { VendorAvailabilityService } from "./vendor-availability.service";
import { VendorPackagesController } from "./vendor-packages.controller";
import { VendorPackagesRepository } from "./vendor-packages.repository";
import { VendorPackagesService } from "./vendor-packages.service";
import { VendorsController } from "./vendors.controller";
import { VendorsRepository } from "./vendors.repository";
import { VendorsService } from "./vendors.service";

@Module({
  imports: [AuthModule],
  // VendorPackagesController/VendorAvailabilityController own the literal
  // "vendors/me/..." routes and must be registered before VendorsController —
  // its "vendors/:id/availability" route would otherwise match "vendors/me/availability"
  // first (Nest/Express resolve routes in registration order, and :id matches "me").
  controllers: [VendorPackagesController, VendorAvailabilityController, VendorsController],
  providers: [
    VendorsService,
    VendorsRepository,
    VendorPackagesService,
    VendorPackagesRepository,
    VendorAvailabilityService,
    VendorAvailabilityRepository,
  ],
})
export class VendorsModule {}
