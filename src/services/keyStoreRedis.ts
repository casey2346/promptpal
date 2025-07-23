import { createClient } from 'redis';
import { logger } from '../utils/logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisClient = createClient({ url: redisUrl });

redisClient.on('error', (err) => logger.error('❌ Redis Client Error', err));
redisClient.connect().then(() => logger.info('✅ Connected to Redis'));

const REDIS_KEY_SET = 'api:keys';

export const redisKeyStoreService = {
  async registerKey(key: string): Promise<boolean> {
    const exists = await redisClient.sIsMember(REDIS_KEY_SET, key);
    if (exists) return false;
    await redisClient.sAdd(REDIS_KEY_SET, key);
    return true;
  },

  async validateKey(key: string): Promise<boolean> {
    return (await redisClient.sIsMember(REDIS_KEY_SET, key)) === 1;
  },

  async revokeKey(key: string): Promise<boolean> {
    const removed = await redisClient.sRem(REDIS_KEY_SET, key);
    return removed > 0;
  },

  async listKeys(): Promise<string[]> {
    return await redisClient.sMembers(REDIS_KEY_SET);
  },
};
