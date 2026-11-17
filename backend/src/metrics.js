import client from 'prom-client';

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const activeSessions = new client.Gauge({
    name: 'interview_sessions_active_total', 
    help: 'Currently active interview sessions', 
    registers: [register] 
})

export const audioChunksRelayed = new client.Counter({ 
    name: 'gemini_audio_chunks_relayed_total', 
    help: 'Total audio chunks relayed to Gemini', 
    registers: [register] 
})

