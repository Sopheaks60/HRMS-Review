import { ValidationPipe, VersioningType } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import type { Request, Response } from "express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true, bodyParser: false });
  app.useLogger(app.get(Logger));
  app.useBodyParser("json", {
    limit: "8mb",
    verify: (request: Request & { rawBody?: Buffer }, _response: Response, buffer: Buffer) => {
      request.rawBody = Buffer.from(buffer);
    },
  });
  app.useBodyParser("text", { type: ["text/plain", "application/x-www-form-urlencoded", "application/octet-stream"], limit: "5mb" });
  app.use(helmet());
  app.enableCors({
    origin: process.env.APP_URL?.split(",") ?? ["http://localhost:3000"],
    credentials: true,
  });
  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle("KromPay API")
    .setDescription("Enterprise HRMS and Cambodia payroll SaaS")
    .setVersion("1.0.0")
    .addBearerAuth()
    .addApiKey({ type: "apiKey", name: "X-Tenant-Slug", in: "header" }, "tenant")
    .build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, swagger), {
    jsonDocumentUrl: "api/docs/openapi.json",
  });

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
}

void bootstrap();
