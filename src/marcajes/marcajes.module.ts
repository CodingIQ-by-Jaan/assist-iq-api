import { Module } from '@nestjs/common';
import { KioscoController, MarcajesController } from './marcajes.controller';
import { MarcajesService } from './marcajes.service';

@Module({
  controllers: [KioscoController, MarcajesController],
  providers: [MarcajesService],
})
export class MarcajesModule {}
