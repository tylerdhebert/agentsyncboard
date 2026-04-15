import { app } from './app'

const PORT = Number(process.env.PORT ?? 31377)

app.listen(PORT, () => {
  console.log(`agentsyncboard server running on http://localhost:${PORT}`)
  console.log(`WebSocket: ws://localhost:${PORT}/ws`)
})
