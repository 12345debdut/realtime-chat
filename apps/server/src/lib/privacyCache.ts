import { prisma } from './prisma';
import { redis } from './redis';

export interface PrivacyFlags {
  readReceiptsEnabled: boolean;
  onlineStatusVisible: boolean;
  typingIndicatorsEnabled: boolean;
}

const CACHE_TTL = 300; // 5 minutes

export async function getPrivacy(userId: string): Promise<PrivacyFlags> {
  const cached = await redis.get(`privacy:${userId}`);
  if (cached) return JSON.parse(cached);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      readReceiptsEnabled: true,
      onlineStatusVisible: true,
      typingIndicatorsEnabled: true,
    },
  });

  const flags: PrivacyFlags = user ?? {
    readReceiptsEnabled: true,
    onlineStatusVisible: true,
    typingIndicatorsEnabled: true,
  };

  await redis.set(`privacy:${userId}`, JSON.stringify(flags), 'EX', CACHE_TTL);
  return flags;
}
