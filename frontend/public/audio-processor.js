class MicrophoneAudioProcessor extends AudioWorkletProcessor {
    process(inputs, outpus, parameters) {
        const inputChannel = inputs[0]?.[0];
        this.port.postMessage(inputChannel);
        return true;
    }

};

registerProcessor("audio-processor", MicrophoneAudioProcessor);