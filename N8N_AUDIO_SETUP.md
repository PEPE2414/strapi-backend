# N8N Audio Analysis Webhook Setup

This document explains how to set up the n8n webhook for audio analysis in the interview practice feature.

## Environment Variables

Add these to your Strapi backend `.env` file:

```env
# N8N Webhook URLs
N8N_AUDIO_ANALYSIS_WEBHOOK=https://your-n8n-instance.com/webhook/audio-analysis
N8N_SHARED_SECRET=your-secret-key-here
```

## Expected Webhook Payload

The Strapi backend will send this payload to your n8n webhook:

```json
{
  "userId": "user-id",
  "sessionId": "practice_1234567890",
  "audioData": "base64-encoded-compressed-audio",
  "question": "Tell me about yourself.",
  "questionIndex": 0,
  "prepTimeUsed": 30,
  "answerTimeUsed": 120,
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

## Expected Response Format

Your n8n webhook should return this response format:

```json
{
  "feedback": "Your response was clear and well-structured. You provided good examples of your experience and skills. Consider adding more specific metrics or achievements to strengthen your answer.",
  "score": 85,
  "strengths": [
    "Clear communication",
    "Good structure",
    "Relevant examples"
  ],
  "improvements": [
    "Add specific metrics",
    "Speak slightly slower",
    "Include more achievements"
  ],
  "transcript": "I'm a recent graduate with a degree in computer science. I have experience in web development and I'm passionate about creating user-friendly applications...",
  "analysis": {
    "clarity": 8.5,
    "structure": 9.0,
    "relevance": 8.0,
    "confidence": 7.5,
    "wordCount": 156,
    "speakingRate": 145,
    "pauseCount": 3
  }
}
```

## Audio Format

- **Input**: Base64-encoded WAV file
- **Compression**: 16kHz sample rate, mono, 16-bit PCM
- **Size**: Typically 50-200KB for 1-2 minute responses

## N8N Workflow Example

1. **Webhook Trigger**: Receive the audio analysis request
2. **Audio Processing**: 
   - Decode base64 audio data
   - Convert to audio file
   - Send to speech-to-text service (OpenAI Whisper, Google Speech-to-Text, etc.)
3. **AI Analysis**:
   - Send transcript + question to AI service (OpenAI GPT-4, Claude, etc.)
   - Generate feedback, score, strengths, improvements
4. **Response**: Return structured feedback

## Security

- Use the `x-cl-secret` header for authentication
- Validate the shared secret before processing
- Consider rate limiting for audio processing

## Error Handling

If processing fails, return:

```json
{
  "error": "Processing failed",
  "message": "Unable to analyze audio at this time"
}
```

The frontend will handle errors gracefully and show a fallback message.
