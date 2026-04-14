import type { User } from '@rtc/contracts';

import { http } from '../../../foundation/network/http';

export const userRepository = {
  async getAll(search?: string): Promise<User[]> {
    const params = search ? { search } : {};
    const { data } = await http.get<User[]>('/users', { params });
    return data;
  },
};
