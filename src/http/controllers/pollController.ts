import { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../service/prisma";
import fastifyCookie from "@fastify/cookie"
import crypto from "node:crypto"

import z, { promise } from "zod";
import { redis } from "../service/redis";
import { voting } from "../../utils/voting-pub-sub";

async function createPoll(request: FastifyRequest, response: FastifyReply) {
    const pollBodySchema = z.object({
        title: z.string({
            required_error: "you must provide a title",

        }),
        options: z.string().array()
    })

    try {
        const pollBody = pollBodySchema.parse(request.body)

        const pollCreated = await prisma.poll.create({
            data: {
                title: pollBody.title,
                options: {
                    createMany: {
                        data: pollBody.options.map(option => {
                            return {
                                title: option
                            }
                        })
                    }
                }
            },

        })


        response.status(201).send({
            pollId: pollCreated.id,

        })

    } catch (error) {
        response.status(404).send({
            message: error
        })
        console.error(error)
    }
}

async function getPoll(request: FastifyRequest, response: FastifyReply) {
    const requestParamsSchema = z.object({
        pollId: z.string().uuid()
    })
    const { pollId } = requestParamsSchema.parse(request.params)

    try {
        const poll = await prisma.poll.findUnique({
            where: {
                id: pollId
            },
            include: {
                options: {
                    select: {
                        title: true,
                        id: true
                    }
                }
            }
        })

        if (!poll) {
            return response.status(400).send({
                message: "Poll not found"
            })
        }

        const result = await redis.zrange(poll.id,0, -1,"WITHSCORES")

        const pollsOptionsScoreMap = new Map<string, number>();

        // Populate the map
        result.forEach((value, index, array) => {
          if (index % 2 === 0) {
            pollsOptionsScoreMap.set(value, Number(array[index + 1]));
          }
        });
        
        const pollsOptions = poll.options.map(option => {
          const { id, title } = option;
          const score = pollsOptionsScoreMap.get(id) ?? 0; // Use optional chaining
          return { id, title, score };
        });
        
        response.status(200).send({
          id: pollId,
          createdAt: poll.createdAt,
          title: poll.title,
          options: pollsOptions
        });


        response.status(200).send({
            id: pollId,
            createdAt: poll.createdAt,
            title: poll.title,
            options: pollsOptions

        })

    } catch (error) {
        console.error(error)
        response.status(404).send({
            message: error
        })
    }

}

async function voteOnPoll(request: FastifyRequest, response: FastifyReply) {
    const requestParamsSchema = z.object({
        pollId: z.string().uuid()
    })
    const requestBodyParams = z.object({
        pollOptionId: z.string().uuid(),
    })

    const { pollId } = requestParamsSchema.parse(request.params)
    const { pollOptionId } = requestBodyParams.parse(request.body)

    try {
        let { sessionId } = request.cookies

        if (!sessionId) {
            sessionId = crypto.randomUUID()

            response.setCookie('sessionId', sessionId, {
                path: '/', // The path the cookie is valid for
                httpOnly: true, // Prevents client-side JavaScript from accessing the cookie
                signed: true, // Only send the cookie over HTTPS
                maxAge: 60 * 60 * 24 * 30, // Cookie expiration time (30 days)
            });

        }

        const userAlreadyVoteInPoll = await prisma.vote.findUnique({
            where: {
                sessionId_pollId: {
                    pollId: pollId,
                    sessionId: sessionId
                }

            }
        })

        if (userAlreadyVoteInPoll && userAlreadyVoteInPoll.pollOptionId !== pollOptionId) {
            await prisma.vote.delete({
                where: {
                    id: userAlreadyVoteInPoll.id
                }
            })
            const vote = await redis.zincrby(pollId, -1, userAlreadyVoteInPoll.pollOptionId)
            voting.publish(pollId, {
                pollOptionId: userAlreadyVoteInPoll.pollOptionId,
                vote: Number(vote)
            })

        }
        else if (userAlreadyVoteInPoll) {
            return response.status(401).send({
                message: "You already voted on this poll"
            })
        }


        await prisma.vote.create({
            data: {
                sessionId,
                pollId,
                pollOptionId,
            }
        })

        const vote = await redis.zincrby(pollId, 1, pollOptionId)

        voting.publish(pollId, {
            pollOptionId: pollOptionId,
            vote: Number(vote)
        })

        response.status(201).send({
            message: "Voted"
        })

    } catch (error) {
        console.error(error)
        response.status(404).send({
            message: error
        })
    }

}

export const poolsController = {
    createPoll,
    getPoll,
    voteOnPoll,
}