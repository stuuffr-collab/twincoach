import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";

@Injectable()
export class AdminKeyGuard implements CanActivate {
  private readonly logger = new Logger(AdminKeyGuard.name);

  canActivate(context: ExecutionContext) {
    const expectedAdminKey = process.env.ALPHA_OPERATOR_KEY?.trim();

    if (!expectedAdminKey) {
      this.logger.error(
        JSON.stringify({
          event: "admin_access_not_configured",
        }),
      );
      throw new InternalServerErrorException("Admin access is not configured");
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const headerValue = request.headers["x-admin-key"];
    const providedAdminKey = Array.isArray(headerValue)
      ? headerValue[0]
      : headerValue;

    if (!providedAdminKey || providedAdminKey !== expectedAdminKey) {
      this.logger.warn(
        JSON.stringify({
          event: "admin_access_denied",
        }),
      );
      throw new UnauthorizedException("Admin access denied");
    }

    return true;
  }
}
