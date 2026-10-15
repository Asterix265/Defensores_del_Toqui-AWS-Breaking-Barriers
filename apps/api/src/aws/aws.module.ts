import { Global, Module } from '@nestjs/common';
import { AlmacenamientoService } from './almacenamiento.service';
import { ColaService } from './cola.service';

@Global()
@Module({
  providers: [AlmacenamientoService, ColaService],
  exports: [AlmacenamientoService, ColaService],
})
export class AwsModule {}
