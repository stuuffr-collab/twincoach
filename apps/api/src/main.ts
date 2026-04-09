import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  process.loadEnvFile?.(".env");
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: readAllowedOrigins(),
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-learner-id", "x-admin-key"],
  });
  const port = Number(process.env.PORT ?? "3001");
  await app.listen(port);
}

function readAllowedOrigins() {
  const configuredOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (configuredOrigins && configuredOrigins.length > 0) {
    return configuredOrigins;
  }

  return ["http://localhost:3000"];
}

void bootstrap();
