import fastify from "fastify";
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import { pollsRoutes } from "./routes/polls";
import fastifyWebsocket from "@fastify/websocket";
import type { FastifyCookieOptions } from '@fastify/cookie'

const apiPort = 3333

const app = fastify({
    logger: true,
})

app.register(cors, {
    origin: "*"
})

app.register(cookie, {
    secret: "pools-nwl", // for cookies signature
    hook: "onRequest",
    
        // options for parsing cookies
} as FastifyCookieOptions)

app.register(fastifyWebsocket)
app.register(pollsRoutes)

app.listen({
    port: apiPort,
    host: '0.0.0.0'
}, (error, address) => {
    console.log(`server listening on  http://localhost:${apiPort}`)
    if (error) {
        app.log.error(error)
        process.exit(1)
    }
})

