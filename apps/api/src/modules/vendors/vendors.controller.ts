import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { AvailabilityRangeQueryDto } from "./dto/availability-range.query.dto";
import { SearchVendorsQueryDto } from "./dto/search-vendors.query.dto";
import { VendorsService } from "./vendors.service";

@Controller("vendors")
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  search(@Query() query: SearchVendorsQueryDto) {
    return this.vendorsService.search(query);
  }

  @Get(":id")
  getProfile(@Param("id", ParseUUIDPipe) id: string) {
    return this.vendorsService.getProfile(id);
  }

  @Get(":id/availability")
  getAvailability(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() range: AvailabilityRangeQueryDto,
  ) {
    return this.vendorsService.getPublicAvailability(id, range);
  }
}
