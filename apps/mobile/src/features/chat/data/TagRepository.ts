import { Q } from '@nozbe/watermelondb';

import { http } from '../../../foundation/network/http';
import { collections, database } from '../../../foundation/storage';
import type { TagModel } from '../../../foundation/storage/models/TagModel';
import type { RoomTagModel } from '../../../foundation/storage/models/RoomTagModel';
import { logger } from '../../../lib/logger';

export const TAG_COLORS = [
  '#4ECDC4',
  '#FF6B6B',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
  '#98D8C8',
  '#F7DC6F',
];

export const tagRepository = {
  async getAllTags(): Promise<TagModel[]> {
    return collections.tags.query().fetch();
  },

  async createTag(name: string, color?: string): Promise<TagModel> {
    const trimmed = name.trim();
    const finalColor = color ?? TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];

    // Reject duplicates locally before hitting the DB
    const existing = await collections.tags
      .query(Q.where('name', trimmed))
      .fetch();
    if (existing.length > 0) {
      throw new Error('tag_exists');
    }

    const tag = await database.write(async () => {
      return collections.tags.create((t) => {
        (t as TagModel).name = trimmed;
        (t as TagModel).color = finalColor;
        (t as TagModel).createdAt = new Date();
      });
    });

    // Sync to server
    try {
      const { data } = await http.post<{ id: string }>('/tags', {
        name: trimmed,
        color: finalColor,
      });
      await database.write(async () => {
        await tag.update((t) => {
          (t as TagModel).serverId = data.id;
        });
      });
    } catch (err: any) {
      const errorCode = err?.response?.data?.error;
      if (errorCode === 'tag_exists') {
        // Server rejected as duplicate — remove the local record we just created
        await database.write(async () => {
          await tag.markAsDeleted();
        });
        throw new Error('tag_exists');
      }
      // Other server errors are best-effort (offline, etc.)
    }

    logger.info('TagRepo', `created tag "${trimmed}"`);
    return tag;
  },

  async getTagsForRoom(roomWatermelonId: string): Promise<TagModel[]> {
    const roomTags = await collections.roomTags
      .query(Q.where('room_id', roomWatermelonId))
      .fetch();

    if (roomTags.length === 0) return [];

    const tagIds = roomTags.map((rt: RoomTagModel) => rt.tagId);
    return collections.tags.query(Q.where('id', Q.oneOf(tagIds))).fetch();
  },

  async addTagToRoom(roomWatermelonId: string, tagId: string): Promise<void> {
    // Check for duplicate
    const existing = await collections.roomTags
      .query(Q.where('room_id', roomWatermelonId), Q.where('tag_id', tagId))
      .fetch();

    if (existing.length > 0) return;

    await database.write(async () => {
      await collections.roomTags.create((rt) => {
        (rt as RoomTagModel).roomId = roomWatermelonId;
        (rt as RoomTagModel).tagId = tagId;
      });
    });

    // Sync to server — need room's serverId
    try {
      const room = await collections.rooms.find(roomWatermelonId);
      const tag = await collections.tags.find(tagId);
      if (tag.serverId && room.serverId) {
        await http.post(`/rooms/${room.serverId}/tags`, { tagId: tag.serverId });
      }
    } catch {
      // best-effort
    }

    logger.info('TagRepo', `added tag ${tagId} to room ${roomWatermelonId}`);
  },

  async removeTagFromRoom(roomWatermelonId: string, tagId: string): Promise<void> {
    const entries = await collections.roomTags
      .query(Q.where('room_id', roomWatermelonId), Q.where('tag_id', tagId))
      .fetch();

    if (entries.length === 0) return;

    await database.write(async () => {
      await database.batch(
        ...entries.map((e: RoomTagModel) => e.prepareMarkAsDeleted()),
      );
    });

    // Sync to server
    try {
      const room = await collections.rooms.find(roomWatermelonId);
      const tag = await collections.tags.find(tagId);
      if (tag.serverId && room.serverId) {
        await http.delete(`/rooms/${room.serverId}/tags/${tag.serverId}`);
      }
    } catch {
      // best-effort
    }

    logger.info('TagRepo', `removed tag ${tagId} from room ${roomWatermelonId}`);
  },

  async deleteTag(tagId: string): Promise<void> {
    const tag = await collections.tags.find(tagId);

    await database.write(async () => {
      // Remove all room_tag associations first
      const roomTags = await collections.roomTags
        .query(Q.where('tag_id', tagId))
        .fetch();
      await database.batch(
        ...roomTags.map((rt: RoomTagModel) => rt.prepareMarkAsDeleted()),
        tag.prepareMarkAsDeleted(),
      );
    });

    // Sync to server
    try {
      if (tag.serverId) {
        await http.delete(`/tags/${tag.serverId}`);
      }
    } catch {
      // best-effort
    }

    logger.info('TagRepo', `deleted tag ${tagId}`);
  },

  async getRoomIdsForTag(tagId: string): Promise<string[]> {
    const roomTags = await collections.roomTags
      .query(Q.where('tag_id', tagId))
      .fetch();
    return roomTags.map((rt: RoomTagModel) => rt.roomId);
  },
};
