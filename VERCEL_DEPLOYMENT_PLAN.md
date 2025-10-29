# Vercel Deployment Plan - Cartesia Voice Conversation Demo

## Executive Summary

This document outlines the complete refactoring plan to deploy the voice conversation demo to Vercel using Edge Functions and Vite.

## Key Findings from Research

### Vercel WebSocket Limitations
- ❌ **Vercel does NOT support native WebSockets** in Edge Functions or Serverless Functions
- ✅ **Vercel DOES support HTTP Response Streaming** (stable as of 2025)
- ✅ **Edge Functions support streaming responses** with low latency
- 🆕 **Rivet for Vercel** (Oct 2025) enables WebSocket servers but adds complexity

### Chosen Architecture: HTTP Streaming with Edge Functions

**Why this approach:**
1. Native Vercel support - no third-party dependencies
2. Low latency with Edge Functions (runs at the edge, close to users)
3. Streaming responses maintain real-time feel
4. API key security (keys stay on server)
5. Works reliably on Vercel's infrastructure

## New Architecture Design

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │ Vite App     │───▶│ Audio        │───▶│ Audio        │      │
│  │ (React/Vue)  │    │ Capture      │    │ Playback     │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │ HTTP POST            │ SSE Stream         ▲           │
└─────────┼──────────────────────┼────────────────────┼───────────┘
          │                      │                    │
          ▼                      ▼                    │
┌─────────────────────────────────────────────────────────────────┐
│                   VERCEL EDGE FUNCTIONS                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  /api/conversation (Edge Function)                       │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐             │   │
│  │  │ Receive  │─▶│ Process  │─▶│ Stream   │             │   │
│  │  │ Audio    │  │ Pipeline │  │ Response │             │   │
│  │  └──────────┘  └──────────┘  └──────────┘             │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │                  │                  │                 │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Cartesia    │  │   OpenAI     │  │  Cartesia    │
│     STT      │  │  GPT-4o-mini │  │     TTS      │
│  (WebSocket) │  │  (Streaming) │  │  (WebSocket) │
└──────────────┘  └──────────────┘  └──────────────┘
```

## Implementation Flow

### Phase 1: Request Flow
1. **Client** captures audio and sends PCM data via HTTP POST to Edge Function
2. **Edge Function** receives audio, opens Cartesia STT WebSocket
3. **STT** transcribes audio and returns text
4. **Edge Function** sends transcript to OpenAI GPT-4o-mini (streaming)
5. **GPT** generates response chunks in real-time
6. **Edge Function** sends each chunk to Cartesia TTS (streaming)
7. **TTS** generates audio chunks
8. **Edge Function** streams audio back to client via SSE/HTTP streaming
9. **Client** plays audio as it arrives

### Phase 2: Latency Tracking
- Track each stage timestamp on server-side
- Stream latency metrics along with audio
- Client displays metrics in real-time

## Detailed Implementation Plan

### Step 1: Project Restructure with Vite ✨

**New Project Structure:**
```
cartesia-conversation-demo/
├── api/                          # Vercel Edge Functions
│   ├── conversation.ts          # Main Edge Function handler
│   └── health.ts                # Health check endpoint
├── src/                         # Vite source code
│   ├── main.ts                  # Entry point
│   ├── App.tsx/vue             # Main app component
│   ├── components/
│   │   ├── AudioRecorder.tsx   # Audio capture component
│   │   ├── AudioPlayer.tsx     # Audio playback component
│   │   ├── ConversationView.tsx # Chat display
│   │   └── LatencyPanel.tsx    # Performance metrics
│   ├── services/
│   │   ├── audioService.ts     # Audio processing utils
│   │   ├── apiClient.ts        # API communication
│   │   └── streamParser.ts    # SSE stream parsing
│   └── types/
│       └── index.ts            # TypeScript types
├── public/                     # Static assets
│   └── index.html
├── vercel.json                 # Vercel configuration
├── vite.config.ts             # Vite configuration
├── package.json
├── tsconfig.json
└── .env.example
```

### Step 2: Vite Configuration

**Key Features:**
- TypeScript support
- React/Vue (user's choice)
- Hot Module Replacement (HMR)
- Optimized production builds
- Environment variable handling

### Step 3: Vercel Edge Function Implementation

**API Endpoints:**

#### `/api/conversation` (Edge Function)
```typescript
// Request: POST with audio data
{
  audio: string,        // base64 PCM audio
  sessionId: string    // session identifier
}

// Response: SSE stream
event: transcript
data: { text: "שלום" }

event: thinking
data: {}

event: gpt_chunk
data: { text: "..." }

event: audio
data: { chunk: "base64_audio_data" }

event: latency
data: { stage: "stt", duration: 234 }

event: complete
data: { totalLatency: 2847 }
```

**Features:**
- Streaming responses via ReadableStream
- WebSocket connections to Cartesia (server-side only)
- OpenAI streaming integration
- Latency tracking at each stage
- Error handling and recovery

### Step 4: Client-Side Refactor

**Technology Stack:**
- **Vite** - Build tool and dev server
- **TypeScript** - Type safety
- **React** or **Vue** - UI framework (user preference)
- **Web Audio API** - Audio recording and playback
- **EventSource** or **fetch streams** - SSE client

**Key Components:**

1. **AudioRecorder Component**
   - Captures microphone input
   - Converts to PCM 16kHz mono
   - Sends to Edge Function via POST

2. **StreamClient Service**
   - Manages SSE connection to Edge Function
   - Parses streaming responses
   - Handles reconnection logic

3. **AudioPlayer Component**
   - Queues incoming audio chunks
   - Plays back with Web Audio API
   - Handles buffer management

4. **LatencyPanel Component**
   - Real-time metric updates
   - Visual breakdown of stages
   - Performance monitoring

### Step 5: Environment Variables

**Vercel Environment Variables (Server):**
```env
CARTESIA_API_KEY=sk_car_...
CARTESIA_API_VERSION=2025-04-16
CARTESIA_VOICE_ID=5351f3f8-06be-4963-800d-fce17daab951
CARTESIA_MODEL_ID=sonic-multilingual
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini
```

**Client Environment Variables:**
```env
VITE_API_BASE_URL=/api  # Relative to Vercel deployment
```

### Step 6: Vercel Configuration

**vercel.json:**
```json
{
  "functions": {
    "api/conversation.ts": {
      "maxDuration": 60,
      "runtime": "edge"
    }
  },
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Step 7: Optimization Strategies

**Edge Function Optimizations:**
1. Keep WebSocket connections alive between requests
2. Connection pooling for Cartesia/OpenAI
3. Streaming responses immediately (no buffering)
4. Aggressive sentence-boundary streaming
5. Minimal serialization overhead

**Client Optimizations:**
1. Audio chunk batching (reduce HTTP overhead)
2. Predictive buffering for smooth playback
3. Web Worker for audio processing
4. Efficient SSE parsing
5. Progressive UI updates

**Latency Targets:**
- Recording → STT: <200ms
- STT complete: <500ms
- LLM first token: <300ms
- TTS first byte: <150ms
- **Total E2E: <2000ms** (goal)

### Step 8: Deployment Process

**Steps:**
1. Install Vercel CLI: `npm i -g vercel`
2. Link project: `vercel link`
3. Add environment variables: `vercel env add`
4. Deploy: `vercel deploy --prod`
5. Verify: Test latency and streaming

## Technology Choices

### Framework Options

**Option A: React + TypeScript**
- Most popular, large ecosystem
- Excellent TypeScript support
- Rich component libraries

**Option B: Vue 3 + TypeScript**
- Simpler learning curve
- Great performance
- Composition API is elegant

**Recommendation: React** (more mature ecosystem for real-time apps)

### State Management

**Option: Zustand or Jotai**
- Lightweight
- TypeScript-first
- Perfect for streaming state updates

### Styling

**Option: Tailwind CSS**
- Utility-first
- Great for responsive design
- Easy to optimize for production

## Testing Strategy

### Local Development
1. `npm run dev` - Vite dev server with HMR
2. `vercel dev` - Test Edge Functions locally
3. Manual testing with different audio inputs

### Production Testing
1. Deploy to preview environment
2. Test latency from different regions
3. Monitor Edge Function logs
4. Verify streaming performance

## Migration Steps (Execution Order)

1. ✅ Create new branch: `git checkout -b vercel-refactor`
2. ✅ Install Vite and dependencies
3. ✅ Create new project structure
4. ✅ Implement Edge Function `/api/conversation`
5. ✅ Build React/Vue client with Vite
6. ✅ Implement audio recording component
7. ✅ Implement SSE client for streaming
8. ✅ Implement audio playback with buffering
9. ✅ Add latency tracking (client + server)
10. ✅ Create vercel.json configuration
11. ✅ Test locally with `vercel dev`
12. ✅ Deploy to Vercel preview
13. ✅ Performance testing and optimization
14. ✅ Merge to main and deploy to production

## Expected Benefits

### Performance
- **Lower latency**: Edge Functions run closer to users
- **Better streaming**: Native HTTP streaming support
- **Faster builds**: Vite's optimized bundling
- **CDN caching**: Static assets cached globally

### Developer Experience
- **Hot Module Replacement**: Instant feedback during dev
- **TypeScript**: Better type safety and IDE support
- **Modern tooling**: Vite's excellent DX
- **Simple deployment**: `vercel deploy`

### Scalability
- **Auto-scaling**: Vercel handles traffic spikes
- **Global distribution**: Edge network worldwide
- **No server management**: Fully serverless
- **Cost-effective**: Pay per execution

## Risks and Mitigations

### Risk 1: Edge Function Timeout
- **Mitigation**: Stream responses immediately, don't buffer
- **Fallback**: Implement request timeout on client, retry logic

### Risk 2: WebSocket Connection from Edge Function
- **Mitigation**: Edge runtime supports WebSocket clients
- **Fallback**: Use HTTP streaming to Cartesia if needed

### Risk 3: Audio Streaming Latency
- **Mitigation**: Aggressive chunking, client-side buffering
- **Monitoring**: Track latency metrics in production

### Risk 4: Cold Starts
- **Mitigation**: Edge Functions have minimal cold starts
- **Monitoring**: Track P99 latencies

## Success Metrics

- ✅ End-to-end latency < 3 seconds (average)
- ✅ P95 latency < 5 seconds
- ✅ Zero deployment downtime
- ✅ Successful streaming in all stages
- ✅ Latency tracking functional
- ✅ No API key exposure on client

## Next Steps

Ready to implement? Reply "yes" and I'll start the full refactoring:
1. Set up Vite project structure
2. Create Edge Functions
3. Build React client
4. Configure Vercel
5. Deploy and test
