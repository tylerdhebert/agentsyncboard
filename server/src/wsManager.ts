export type WsClient = {
  send(data: string): void
}

const clients = new Set<WsClient>()

export const wsManager = {
  add(client: WsClient) {
    clients.add(client)
  },
  remove(client: WsClient) {
    clients.delete(client)
  },
  broadcast(event: string, data: unknown) {
    const msg = JSON.stringify({ event, data })
    for (const client of clients) {
      try {
        client.send(msg)
      } catch {
        clients.delete(client)
      }
    }
  },
}
