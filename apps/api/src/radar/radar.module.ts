import { Module } from '@nestjs/common';
import { RadarController } from './radar.controller';
import { RadarService } from './radar.service';
import { FreelancerClient } from './freelancer.client';
import { ProposalGenerator } from './proposal.generator';
import { FreelancerAuthClient } from './freelancer-auth.client';
import { FreelancerOauthController } from './freelancer-oauth.controller';

@Module({
  controllers: [RadarController, FreelancerOauthController],
  providers: [RadarService, FreelancerClient, ProposalGenerator, FreelancerAuthClient],
  exports: [RadarService, FreelancerAuthClient],
})
export class RadarModule {}
