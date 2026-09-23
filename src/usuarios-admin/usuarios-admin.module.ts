import { Module } from '@nestjs/common';
import { UsuariosAdminController } from './usuarios-admin.controller';
import { UsuariosAdminService } from './usuarios-admin.service';

@Module({
  controllers: [UsuariosAdminController],
  providers: [UsuariosAdminService],
})
export class UsuariosAdminModule {}
