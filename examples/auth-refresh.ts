import { createClient } from '@kkfive/request'

const store = { access: 'initial-token', refresh: 'refresh-token' }

export function authWithRefresh(): ReturnType<typeof createClient> {
  return createClient({
    prefix: 'https://api.example.com',
    auth: {
      getToken: () => store.access,
      refreshToken: {
        getRefreshToken: () => store.refresh,
        refresh: async (refreshToken) => {
          const res = await fetch('https://api.example.com/auth/refresh', {
            method: 'POST',
            body: JSON.stringify({ refreshToken }),
          })
          return (await res.json() as { accessToken: string }).accessToken
        },
        onRefreshSuccess: (newToken) => {
          store.access = newToken
        },
        onRefreshFail: () => {
          // 跳转登录页等。
        },
      },
    },
    onUnauthorized: () => {
      // 刷新失败 / 无 refreshToken 时的 401 兜底。
    },
  })
}
