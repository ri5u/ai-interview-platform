import { createServer } from 'node:http';
import express from 'express';
import cors from 'cors';
import WebSocket, { WebSocketServer } from "ws";
import { GoogleGenAI, Modality } from "@google/genai";
import "dotenv/config"

import { initDb } from './src/db.js';
import authRoutes from './src/routes/authRoutes.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);

const server = createServer(app);
const wss = new WebSocketServer({server});

const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY})
const model = 'gemini-3.8-live'
const PROMPTS = {
  dsa: `You are an experienced Staff Software Engineer conducting an entry-level Data Structures & Algorithms (DSA) live coding interview.
Primary Interaction: Spoken conversational audio. Keep responses concise, vocal, and professional.
1. Problem Selection: Start with a brief greeting and present ONE standard DSA problem appropriate for an entry-level SDE (e.g., sliding window, two-pointer, BFS/DFS, binary search). Present a concise, realistic problem statement.
2. Clarification & Discussion: Ask the candidate to explain their edge-case considerations and time/space complexity before they start writing code.
3. Code Updates: You will receive periodic text updates labeled [EDITOR_SNAPSHOT]. Treat them as ambient context; do NOT interrupt or read their code back simply because a snapshot arrived.
4. Review: Only evaluate, critique, or give feedback on the code when the candidate verbally asks or pauses for feedback.`,

  lld: `You are an experienced Staff Software Engineer conducting an entry-level Low-Level Design (LLD) / Object-Oriented Design mock interview.
Primary Interaction: Spoken conversational audio. Keep responses concise, vocal, and professional.
1. Problem Selection: Start with a brief greeting and present ONE classic fresher-level LLD problem (e.g., Parking Lot, Elevator System, Rate Limiter, Splitwise). State the core prompt concisely without volunteering the full spec.
2. Requirements Gathering: Wait for the candidate to ask clarifying questions and establish functional requirements. Push them to define key entities, relationships, and design patterns.
3. Architecture First: Ask them to discuss interfaces and class designs verbally or in pseudocode before writing full code.
4. Code Updates: You will receive periodic text updates labeled [EDITOR_SNAPSHOT]. Treat them as ambient context. Critique SOLID principles, extensibility, and concurrency only when the candidate asks or pauses to discuss.`
};


wss.on("connection", async(ws) => {
    let session = null;
    let selectedPrompt = null;
    console.debug("Session Started");
    ws.on('message', async (message) => {
        try {
            const packet = JSON.parse(message.toString());
            if(packet.type === 'init') {
                selectedPrompt = PROMPTS[packet.mode] || PROMPTS.dsa;
                session = await ai.live.connect({
                    model: model,
                    callbacks: {
                        onopen: function () {
                            console.debug("Opened!!!");
                        },
                        onmessage: function (message) {
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
                            //will remove before pushing to prod
                            if (content.outputTranscription?.text) {
                                process.stdout.write(content.outputTranscription.text);
                            }

                            if (content.interrupted) {
                                ws.send(JSON.stringify({
                                    type: "interrupted"
                                }));
                            }
                        },
                        onerror: function (e) {
                            console.debug('Error', e.message);
                        },
                        onclose: function (e) {
                            console.debug('Close ', e.reason);
                        },
                    },
                    config: {
                        responseModalities: [Modality.AUDIO],
                        outputAudioTranscription: {},
                        inputAudioTranscription: {},
                        systemInstruction: {
                            parts: [{ text: selectedPrompt }]
                        },
                    }
                })
            } else if (packet.type === 'code') {
                console.log("Received code update")
                session?.sendRealtimeInput({
                    text: `[EDITOR_SNAPSHOT]\n${packet.data}`
                })
            } else if(packet.type === 'audio') {
                session?.sendRealtimeInput({
                    audio: {
                        data: packet.data, 
                        mimeType: 'audio/pcm;rate=16000'
                    }
                })
            } else if(packet.type === 'stop') {
                if(session) {
                    session.close();
                    session = null;
                }
            }
        } catch(err) {
            console.error('Failed to parse incoming packet:', err);
        }
    })

    ws.on('close', () => {
        session?.close();
        session = null;
    })
})

const PORT = 8080;
server.listen(PORT, async () => {
    console.log(`Backend server listening on http://localhost:${PORT}`);
    await initDb();
})