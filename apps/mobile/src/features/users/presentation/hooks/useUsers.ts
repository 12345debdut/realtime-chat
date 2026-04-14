import { useCallback, useEffect, useState } from 'react';

import type { User } from '@rtc/contracts';

import { userRepository } from '../../data/UserRepository';

export function useUsers(search: string) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async (query?: string) => {
    try {
      setLoading(true);
      const data = await userRepository.getAll(query);
      setUsers(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(search || undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, fetchUsers]);

  const removeUser = useCallback((userId: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  }, []);

  return { users, loading, removeUser };
}
