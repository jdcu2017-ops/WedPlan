import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthRepository } from "./auth.repository";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, JwtAuthGuard],
  // JwtModule must be re-exported too, not just JwtAuthGuard — otherwise a
  // module that imports AuthModule only to use the guard can't resolve the
  // guard's own JwtService dependency (Nest resolves it from the consuming
  // module's context, not AuthModule's).
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}
