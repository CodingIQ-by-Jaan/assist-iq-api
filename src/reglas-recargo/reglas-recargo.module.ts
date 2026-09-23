import { Module } from '@nestjs/common';
import { ReglasRecargoController } from './reglas-recargo.controller';
import { ReglasRecargoService } from './reglas-recargo.service';

@Module({
  controllers: [ReglasRecargoController],
  providers: [ReglasRecargoService],
})
export class ReglasRecargoModule {}
