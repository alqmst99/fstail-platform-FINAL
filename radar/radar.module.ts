import { Module } from '@nestjs/common';
import { RadarController } from './radar.controller';
import { RadarService } from './radar.service';
import { FreelancerClient } from './freelancer.client';
import { ProposalGenerator } from './proposal.generator';

@Module({
  controllers: [RadarController],
  providers: [RadarService, FreelancerClient, ProposalGenerator],
  exports: [RadarService],
})
export class RadarModule {}
