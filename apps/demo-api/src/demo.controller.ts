import {
  Controller,
  Get,
  Param,
  Post,
  UnauthorizedException,
  Headers,
  HttpCode,
} from "@nestjs/common";

/**
 * Temporary traffic generators until the URL shortener lands.
 * Includes a protected route so 401 shows up in metrics.
 */
@Controller()
export class DemoController {
  @Get("ping")
  ping() {
    return { pong: true, at: new Date().toISOString() };
  }

  @Get("slow")
  async slow() {
    await new Promise((r) => setTimeout(r, 120));
    return { ok: true, delayedMs: 120 };
  }

  @Get("items/:id")
  item(@Param("id") id: string) {
    return { id, name: `item-${id}` };
  }

  @Post("admin/echo")
  @HttpCode(200)
  adminEcho(@Headers("x-api-key") apiKey?: string) {
    if (!apiKey || apiKey !== "demo-secret") {
      throw new UnauthorizedException("Missing or invalid x-api-key");
    }
    return { ok: true, role: "admin" };
  }
}
