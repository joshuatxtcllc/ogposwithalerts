import { useQuery } from '@tanstack/react-query';

export function useAuth() {
  const { data: user, isLoading, refetch } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      const response = await fetch('/api/auth/user');
      if (!response.ok) {
        if (response.status === 401) {
          return null;
        }
        throw new Error('Failed to fetch user');
      }
      return response.json();
    },
  });

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    refetch,
  };
}
