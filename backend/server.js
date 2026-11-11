import WebSocket, { WebSocketServer } from "ws";
import { GoogleGenAI, Modality } from "@google/genai";

import "dotenv/config"

const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY})
const model = 'gemini-3.8-live'
const config = {
    responseModalities: [Modality.AUDIO], 
    ouputAudioTranscription: {}, 
    inputAudioTranscription: {},
    systemInstruction: {
        parts: [
            {
                text: `You are an experienced Staff Software Engineer conducting a real-time technical coding and LLD interview for an entry-level SDE role.
                Operational Guidelines:
                1. Primary Interaction: Converse naturally using audio speech. Keep your responses concise, vocal, and professional.
                2. Code Updates: You will periodically receive text labeled with [EDITOR_SNAPSHOT]. This represents the current state of the candidate's Monaco code editor. Treat it as ambient visual context. Do NOT interrupt the candidate or read their code back to them simply because a snapshot arrived.
                3. Code Inquiries: Only evaluate, critique, or give feedback on the code when the candidate verbally asks for feedback, explains their logic, or pauses to discuss their implementation.
                4. Interview Structure: Start with a brief greeting, present a coding problem, ask them to clarify requirements, and guide them through their solution.`
            }
        ]
    },
}

const wss = new WebSocketServer({port: 8080});
wss.on("connection", async(ws) => {
    const session = await ai.live.connect({
        model: model, 
        callbacks: {
            onopen: function() {
                console.debug("Opened!!!");
            },
            onmessage: function(message) {
                const content = message.serverContent;
                if (!content) return;

                // 1. Audio chunks -> wrap in JSON envelope for React
                if (content.modelTurn?.parts) {
                    for (const part of content.modelTurn.parts) {
                        if (part.inlineData?.data) {
                            ws.send(JSON.stringify({
                                type: "audio",
                                data: part.inlineData.data
                            }));
                        }
                    }
                }

                // 2. Transcripts (optional but helpful for console/UI)
                if (content.outputTranscription?.text) {
                    process.stdout.write(content.outputTranscription.text);
                }

                // 3. Barge-in / interruption signal
                if (content.interrupted) {
                    ws.send(JSON.stringify({
                        type: "interrupted"
                    }));
                }
            },
            onerror: function(e){
                console.debug('Error', e.message);
            },
            onclose: function(e) {
                console.debug('Close:', e.reason);
            },
        },
        config: config,
    })
    console.debug("Session Started");
    ws.on('message', (message) => {
        try {
            const packet = JSON.parse(message.toString());

            if(packet.type === 'code') {
                console.log("Received code update")
                session.sendRealtimeInput({
                    text: `[EDITOR_SNAPSHOT]\n${packet.data}`
                })
            } else if(packet.type === 'audio') {
                session.sendRealtimeInput({
                    audio: {
                        data: packet.data, 
                        mimeType: 'audio/pcm;rate=16000'
                    }
                })
            }
        } catch(err) {
            console.error('Failed to parse incoming packet:', err);
        }
    })
})