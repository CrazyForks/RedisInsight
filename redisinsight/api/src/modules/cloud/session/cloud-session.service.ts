import { Injectable } from '@nestjs/common';
import { SessionService } from 'src/modules/session/session.service';
import { CloudSession } from 'src/modules/cloud/session/models/cloud-session';
import { instanceToPlain, plainToInstance } from 'class-transformer';
import { TransformGroup } from 'src/common/constants';
import { CloudSessionRepository } from './repositories/cloud.session.repository';

@Injectable()
export class CloudSessionService {
  constructor(
    private readonly sessionService: SessionService,
    private readonly cloudSessionRepository: CloudSessionRepository,
  ) {}

  async getSession(id: string): Promise<CloudSession> {
    const session = await this.sessionService.getSession(id);
    const cloud = session?.data?.cloud;
    if (!cloud?.refreshToken) {
      try {
        const cloudSessionData = await this.cloudSessionRepository.get();
        if (cloudSessionData?.data) {
          const { data } = cloudSessionData;

          const sessionData = {
            ...cloud,
            refreshToken: data.refreshToken,
            idpType: data.idpType,
          };

          if (data.idpType === 'sso') {
            sessionData['idToken'] = data.idToken;
          }

          return sessionData;
        }
      } catch (e) {
        // ignore
      }
    }
    return cloud || null;
  }

  async updateSessionData(id: string, cloud: any): Promise<CloudSession> {
    const session = await this.getSession(id);

    const cloudSession =
      (
        await this.sessionService.updateSessionData(id, {
          cloud: plainToInstance(
            CloudSession,
            {
              ...instanceToPlain(session, { groups: [TransformGroup.Secure] }),
              ...instanceToPlain(cloud, { groups: [TransformGroup.Secure] }),
            },
            { groups: [TransformGroup.Secure] },
          ),
        })
      )?.data?.cloud || null;

    if (cloudSession && cloud?.refreshToken && cloud?.idpType) {
      try {
        const data = {
          refreshToken: cloud.refreshToken,
          idpType: cloud.idpType,
        };

        if (cloud.idpType === 'sso') {
          data['idToken'] = cloud.idToken;
        }

        this.cloudSessionRepository.save({
          data,
        });
      } catch (e) {
        // ignore
      }
    }

    return cloudSession;
  }

  async deleteSessionData(id: string): Promise<void> {
    await this.sessionService.updateSessionData(id, { cloud: null });

    try {
      await this.cloudSessionRepository.save({ data: null });
    } catch (e) {
      // ignore
    }
  }

  async invalidateApiSession(id: string): Promise<void> {
    await this.updateSessionData(id, {
      csrf: null,
      apiSessionId: null,
      user: null,
    });
  }
}
