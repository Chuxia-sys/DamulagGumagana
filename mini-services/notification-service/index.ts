import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// Track connected users
const userSockets = new Map<string, Set<string>>() // userId -> Set of socket.ids

io.on('connection', (socket) => {
  console.log(`[NotificationService] Client connected: ${socket.id}`)

  // User joins with their userId
  socket.on('join', (data: { userId: string }) => {
    const { userId } = data
    if (!userId) return
    
    // Track this socket for the user
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set())
    }
    userSockets.get(userId)!.add(socket.id)
    
    // Join user-specific room
    socket.join(`user:${userId}`)
    socket.data.userId = userId
    
    console.log(`[NotificationService] User ${userId} joined (socket: ${socket.id})`)
    console.log(`[NotificationService] Total users connected: ${userSockets.size}`)
  })

  // Internal API: Send notification to specific user
  socket.on('notify-user', (data: { 
    userId: string
    notification: {
      id?: string
      title: string
      message: string
      type: 'info' | 'success' | 'warning' | 'error'
      actionUrl?: string
    }
  }) => {
    const { userId, notification } = data
    console.log(`[NotificationService] Sending notification to user ${userId}: ${notification.title}`)
    
    io.to(`user:${userId}`).emit('notification', {
      id: notification.id || Math.random().toString(36).substr(2, 9),
      ...notification,
      timestamp: new Date().toISOString()
    })
  })

  // Internal API: Broadcast to all connected users
  socket.on('notify-all', (data: { 
    title: string
    message: string
    type: 'info' | 'success' | 'warning' | 'error'
  }) => {
    console.log(`[NotificationService] Broadcasting: ${data.title}`)
    
    io.emit('notification', {
      id: Math.random().toString(36).substr(2, 9),
      ...data,
      timestamp: new Date().toISOString()
    })
  })

  socket.on('disconnect', () => {
    const userId = socket.data.userId
    if (userId && userSockets.has(userId)) {
      userSockets.get(userId)!.delete(socket.id)
      if (userSockets.get(userId)!.size === 0) {
        userSockets.delete(userId)
      }
    }
    console.log(`[NotificationService] Client disconnected: ${socket.id}`)
  })

  socket.on('error', (error) => {
    console.error(`[NotificationService] Socket error (${socket.id}):`, error)
  })
})

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`[NotificationService] WebSocket server running on port ${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[NotificationService] Shutting down...')
  httpServer.close(() => process.exit(0))
})

process.on('SIGINT', () => {
  console.log('[NotificationService] Shutting down...')
  httpServer.close(() => process.exit(0))
})

export { io }
