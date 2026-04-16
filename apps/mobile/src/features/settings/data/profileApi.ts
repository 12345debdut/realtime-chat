import type { ProfileUpdate, User } from '@rtc/contracts';
import { http } from '../../../foundation/network/http';

export async function patchProfile(changes: ProfileUpdate): Promise<User> {
  const { data } = await http.patch<User>('/me/profile', changes);
  return data;
}
