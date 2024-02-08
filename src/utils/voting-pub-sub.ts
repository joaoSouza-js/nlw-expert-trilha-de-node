type Message = {pollOptionId: string, vote:number}
type Subscribe = (message: Message) => void 

class VotingPubSub {
    private channels:  Record<string, Subscribe[]> = {}

    subscribe(pollId: string, subscribe: Subscribe) {
        if(!this.channels[pollId]){
            this.channels[pollId] = []
        }

        this.channels[pollId].push(subscribe)
    }
    publish(pollId: string,message: Message) {
        if(!this.channels[pollId]){
            return
        }

        for (const subscriber of this.channels[pollId]){
            subscriber(message)
        }
    }
    
}

export const voting = new VotingPubSub