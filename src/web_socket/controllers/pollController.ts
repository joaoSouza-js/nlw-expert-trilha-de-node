import  { SocketStream } from "@fastify/websocket";
import { FastifyRequest } from "fastify";
import z from "zod";
import { voting } from "../../utils/voting-pub-sub";

export  function pollResult(connection:SocketStream, request: FastifyRequest){
    const requestParamsSchema = z.object({
        pollId: z.string().uuid()
    })

    const {pollId} = requestParamsSchema.parse(request.params)

    voting.subscribe(pollId, (message) => {
        connection.socket.send(JSON.stringify(message))
    })

   
}

export const PollWebSocketController = {
    pollResult
}

