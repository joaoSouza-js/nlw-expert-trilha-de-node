import { FastifyInstance } from "fastify";
import { poolsController } from "../controllers/pollController";
import { PollWebSocketController } from "../../web_socket/controllers/pollController";

export async function  pollsRoutes(app : FastifyInstance){
    app.post("/polls", poolsController.createPoll)
    app.get("/polls/:pollId", poolsController.getPoll)
    app.post("/polls/:pollId/vote", poolsController.voteOnPoll)
    app.get("/polls/:pollId/result",{websocket: true}, PollWebSocketController.pollResult)
}