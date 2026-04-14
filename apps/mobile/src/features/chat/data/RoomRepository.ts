import { Q } from '@nozbe/watermelondb';

import { EventNames, type Room, type RoomWithMeta, type Tag } from '@rtc/contracts';

import { http } from '../../../foundation/network/http';
import { collections, database } from '../../../foundation/storage';
import type { MembershipModel } from '../../../foundation/storage/models/MembershipModel';
import type { RoomModel } from '../../../foundation/storage/models/RoomModel';
import type { RoomTagModel } from '../../../foundation/storage/models/RoomTagModel';
import type { TagModel } from '../../../foundation/storage/models/TagModel';
import { logger } from '../../../lib/logger';

import { getActiveRoomId, getSocketInstance } from './SyncEngine';

export const roomRepository = {
  async syncFromServer(): Promise<void> {
    try {
      // Fetch rooms (now includes isPinned + tags) and user's tags
      const [{ data: rooms }, { data: serverTags }] = await Promise.all([
        http.get<RoomWithMeta[]>('/rooms'),
        http.get<Tag[]>('/tags'),
      ]);

      await database.write(async () => {
        // --- Sync tags ---
        for (const sTag of serverTags) {
          const existingTag = await collections.tags
            .query(Q.where('server_id', sTag.id))
            .fetch();

          if (existingTag.length) {
            await existingTag[0].update((t) => {
              (t as TagModel).name = sTag.name;
              (t as TagModel).color = sTag.color;
            });
          } else {
            // Check if there's a local tag with same name but no serverId (created offline)
            const localMatch = await collections.tags
              .query(Q.where('name', sTag.name), Q.where('server_id', null))
              .fetch();
            if (localMatch.length) {
              await localMatch[0].update((t) => {
                (t as TagModel).serverId = sTag.id;
                (t as TagModel).color = sTag.color;
              });
            } else {
              await collections.tags.create((t) => {
                (t as TagModel).name = sTag.name;
                (t as TagModel).color = sTag.color;
                (t as TagModel).serverId = sTag.id;
                (t as TagModel).createdAt = new Date(sTag.createdAt);
              });
            }
          }
        }

        // --- Sync rooms ---
        for (const room of rooms) {
          const existing = await collections.rooms
            .query(Q.where('server_id', room.id))
            .fetch();

          let localRoom: RoomModel;

          if (existing.length) {
            const isActiveRoom = room.id === getActiveRoomId();
            await existing[0].update((r) => {
              (r as RoomModel).title = room.title;
              (r as RoomModel).lastMessagePreview = room.lastMessagePreview;
              (r as RoomModel).lastMessageAt = room.lastMessageAt;
              (r as RoomModel).isPinned = room.isPinned;
              // If the user is currently viewing this room, keep unread at 0
              // (they've already read everything). Otherwise take the higher
              // of server vs local — the client may have incremented from a
              // realtime socket event the server API hasn't caught up with.
              if (!isActiveRoom) {
                (r as RoomModel).unreadCount = Math.max(
                  room.unreadCount ?? 0,
                  existing[0].unreadCount ?? 0,
                );
              }
              (r as RoomModel).updatedAt = new Date(room.updatedAt);
            });
            localRoom = existing[0];
          } else {
            localRoom = await collections.rooms.create((r) => {
              (r as RoomModel).serverId = room.id;
              (r as RoomModel).kind = room.kind;
              (r as RoomModel).title = room.title;
              (r as RoomModel).lastMessagePreview = room.lastMessagePreview;
              (r as RoomModel).lastMessageAt = room.lastMessageAt;
              (r as RoomModel).isPinned = room.isPinned;
              (r as RoomModel).unreadCount = room.unreadCount;
              (r as RoomModel).createdAt = new Date(room.createdAt);
              (r as RoomModel).updatedAt = new Date(room.updatedAt);
            });
          }

          // --- Sync room tags ---
          const existingRoomTags = await collections.roomTags
            .query(Q.where('room_id', localRoom.id))
            .fetch();

          // Build set of server tag local IDs for this room
          const serverTagLocalIds = new Set<string>();
          for (const sTag of room.tags) {
            const localTag = await collections.tags
              .query(Q.where('server_id', sTag.id))
              .fetch();
            if (localTag.length) {
              serverTagLocalIds.add(localTag[0].id);
            }
          }

          // Remove room_tags not on server
          for (const rt of existingRoomTags) {
            if (!serverTagLocalIds.has((rt as RoomTagModel).tagId)) {
              await (rt as RoomTagModel).markAsDeleted();
            }
          }

          // Add room_tags from server that don't exist locally
          const existingTagIds = new Set(
            existingRoomTags.map((rt) => (rt as RoomTagModel).tagId),
          );
          for (const tagId of serverTagLocalIds) {
            if (!existingTagIds.has(tagId)) {
              await collections.roomTags.create((rt) => {
                (rt as RoomTagModel).roomId = localRoom.id;
                (rt as RoomTagModel).tagId = tagId;
              });
            }
          }

          // --- Sync memberships ---
          const existingMemberships = await collections.memberships
            .query(Q.where('room_id', localRoom.id))
            .fetch();
          const existingMemberUserIds = new Set(
            existingMemberships.map((m) => (m as MembershipModel).userId),
          );
          for (const memberId of room.memberIds) {
            if (!existingMemberUserIds.has(memberId)) {
              await collections.memberships.create((m) => {
                (m as MembershipModel).roomId = localRoom.id;
                (m as MembershipModel).userId = memberId;
              });
            }
          }
        }
      });

      // Join socket rooms — respect the active room state.
      // If inside a specific chat room, only join that one.
      // If on the chat list (no active room), join all rooms.
      const activeRoom = getActiveRoomId();
      const socket = getSocketInstance();
      if (socket?.connected) {
        if (activeRoom) {
          // Inside a chat room — only ensure that room is joined
          socket.emit(EventNames.RoomJoin, { roomId: activeRoom });
        } else {
          // On chat list — join all rooms for realtime updates
          const allRooms = await collections.rooms.query().fetch();
          for (const room of allRooms) {
            socket.emit(EventNames.RoomJoin, { roomId: room.serverId });
          }
        }
      }

      logger.info('RoomRepo', `synced ${rooms.length} rooms, ${serverTags.length} tags`);
    } catch (err) {
      logger.error('RoomRepo', 'syncFromServer failed', err);
    }
  },

  async deleteRoom(watermelonId: string): Promise<void> {
    try {
      // Get serverId before deleting locally
      const room = await collections.rooms.find(watermelonId);
      const serverId = room.serverId;

      await database.write(async () => {
        const messages = await room.messages.fetch();
        const memberships = await collections.memberships
          .query(Q.where('room_id', room.id))
          .fetch();
        const roomTags = await collections.roomTags
          .query(Q.where('room_id', room.id))
          .fetch();

        await database.batch(
          ...messages.map((m) => m.prepareMarkAsDeleted()),
          ...memberships.map((m) => m.prepareMarkAsDeleted()),
          ...roomTags.map((rt: RoomTagModel) => rt.prepareMarkAsDeleted()),
          room.prepareMarkAsDeleted(),
        );
      });

      // Also leave on the server
      try {
        await http.delete(`/rooms/${serverId}`);
      } catch {
        // server delete is best-effort
      }

      logger.info('RoomRepo', `deleted room ${watermelonId}`);
    } catch (err) {
      logger.error('RoomRepo', 'deleteRoom failed', err);
    }
  },

  async togglePin(watermelonId: string): Promise<void> {
    try {
      const room = await collections.rooms.find(watermelonId);
      const newPinned = !room.isPinned;

      await database.write(async () => {
        await room.update((r) => {
          (r as RoomModel).isPinned = newPinned;
        });
      });

      // Sync to server
      try {
        await http.put(`/rooms/${room.serverId}/pin`);
      } catch {
        // server sync is best-effort
      }

      logger.info('RoomRepo', `toggled pin for room ${watermelonId} -> ${newPinned}`);
    } catch (err) {
      logger.error('RoomRepo', 'togglePin failed', err);
    }
  },

  async upsertRoom(room: Room): Promise<void> {
    await database.write(async () => {
      const existing = await collections.rooms.query(Q.where('server_id', room.id)).fetch();
      let localRoom: RoomModel;
      if (existing.length) {
        // Update existing room so title / preview changes are not silently dropped
        await existing[0].update((r) => {
          (r as RoomModel).title = room.title;
          (r as RoomModel).lastMessagePreview = room.lastMessagePreview;
          (r as RoomModel).lastMessageAt = room.lastMessageAt;
          (r as RoomModel).updatedAt = new Date(room.updatedAt);
        });
        localRoom = existing[0];
      } else {
        localRoom = await collections.rooms.create((r) => {
          (r as RoomModel).serverId = room.id;
          (r as RoomModel).kind = room.kind;
          (r as RoomModel).title = room.title;
          (r as RoomModel).lastMessagePreview = room.lastMessagePreview;
          (r as RoomModel).lastMessageAt = room.lastMessageAt;
          (r as RoomModel).isPinned = false;
          (r as RoomModel).unreadCount = 0;
          (r as RoomModel).createdAt = new Date(room.createdAt);
          (r as RoomModel).updatedAt = new Date(room.updatedAt);
        });
      }

      // Sync memberships
      const existingMemberships = await collections.memberships
        .query(Q.where('room_id', localRoom.id))
        .fetch();
      const existingMemberUserIds = new Set(
        existingMemberships.map((m) => (m as MembershipModel).userId),
      );
      for (const memberId of room.memberIds) {
        if (!existingMemberUserIds.has(memberId)) {
          await collections.memberships.create((m) => {
            (m as MembershipModel).roomId = localRoom.id;
            (m as MembershipModel).userId = memberId;
          });
        }
      }
    });
  },
};
