declare global {
  // eslint-disable-next-line vars-on-top
  var __TEST_SERVER_URL__: string
}

export function getBaseUrl(): string {
  return globalThis.__TEST_SERVER_URL__
}
