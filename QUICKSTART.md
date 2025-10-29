# Quick Start Guide

## Get Up and Running in 3 Minutes

### Step 1: Install Dependencies (30 seconds)

```bash
cd cartesia-conversation-demo
npm install
```

### Step 2: Configure API Keys (1 minute)

```bash
cp .env.example .env
```

Edit `.env` and replace the placeholder values:

```env
CARTESIA_API_KEY=your_actual_cartesia_key
OPENAI_API_KEY=your_actual_openai_key
```

**Don't have API keys yet?**
- Cartesia: https://cartesia.ai → Sign up → Dashboard → API Keys
- OpenAI: https://platform.openai.com → API Keys → Create new key

### Step 3: Run the App (10 seconds)

```bash
npm start
```

Open your browser to: **http://localhost:3000**

### Step 4: Test the Conversation

1. Click **"Connect"** button
2. Allow microphone access when prompted
3. Click **"Start Recording"**
4. Say something like: "Hello, how are you?"
5. Click **"Stop Recording"**
6. Watch as your speech is transcribed, processed by AI, and responded to with voice!

## That's It!

You now have a fully functional voice AI conversation system.

## Next Steps

- Try different voices by changing `CARTESIA_VOICE_ID` in `.env`
- Modify the system prompt in `src/server.js:145` to customize AI personality
- Check out the full README.md for advanced configuration

## Common Issues

**"Microphone not working"**: Grant browser permission and refresh

**"Connection error"**: Check that both API keys are valid and have credits

**"No audio output"**: Check browser audio settings and try using headphones

Enjoy your voice AI! 🎙️
