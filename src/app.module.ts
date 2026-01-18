import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { HealthController } from './health.controller';
import { VisitsModule } from './visits/visits.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        // Support both MONGODB_URI and individual env vars
        const mongodbUri = configService.get<string>('MONGODB_URI');
        if (mongodbUri) {
          return { uri: mongodbUri };
        }

        // Build URI from individual components
        const username = configService.get<string>('MONGO_USERNAME', '');
        const password = configService.get<string>('MONGO_PASSWORD', '');
        const host = configService.get<string>('MONGO_HOST', 'localhost');
        const port = configService.get<string>('MONGO_PORT', '27017');
        const database = configService.get<string>('MONGO_DATABASE', 'tech_challenge');
        const authSource = configService.get<string>('MONGO_AUTH_SOURCE', 'admin');

        const credentials = username && password ? `${username}:${password}@` : '';
        const uri = `mongodb://${credentials}${host}:${port}/${database}?authSource=${authSource}`;

        return { uri };
      },
      inject: [ConfigService],
    }),
    VisitsModule,
  ],
  controllers: [AppController, HealthController],
})
export class AppModule {}
