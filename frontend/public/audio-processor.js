class MicrophoneAudioProcessor extends AudioWorkletProcessor {
    process(inputs) {
        const inputChannel = inputs[0]?.[0];
        if(inputChannel && inputChannel.length > 0){
            this.port.postMessage(inputChannel);
        }
        return true;
    }

};

registerProcessor("audio-processor", MicrophoneAudioProcessor);