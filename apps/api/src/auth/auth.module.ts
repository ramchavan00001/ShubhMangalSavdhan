import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpSender } from './otp-sender';

@Module({
  controllers: [AuthController],
  providers: [AuthService, OtpSender],
})
export class AuthModule {}
