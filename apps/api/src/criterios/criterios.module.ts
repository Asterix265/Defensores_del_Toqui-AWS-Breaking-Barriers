import { Module } from '@nestjs/common';
import { CriteriosController } from './criterios.controller';
import { CriteriosService } from './criterios.service';

@Module({
  controllers: [CriteriosController],
  providers: [CriteriosService],
  exports: [CriteriosService],
})
export class CriteriosModule {}
