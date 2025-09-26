const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const KEY = process.env.OPENAI_API_KEY;
type LLMArgs = { instruction: string; text: string; maxOut?: number };
export async function llmAssist({instruction, text, maxOut=256}: LLMArgs): Promise<string|undefined> {
  if (!KEY) return undefined; // disabled if no key
  const rsp = await fetch('https://api.openai.com/v1/chat/completions', {
    method:'POST',
    headers:{ 'authorization':`Bearer ${KEY}`, 'content-type':'application/json' },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      max_tokens: maxOut,
      messages:[
        { role:'system', content:'You convert messy job HTML/text into short, clean fields. Output plain text only.'},
        { role:'user', content:`INSTRUCTION:\n${instruction}\n\nTEXT:\n${text}` }
      ]
    })
  }).then(r=>r.json()).catch(()=>null);
  const out = (rsp as any)?.choices?.[0]?.message?.content?.trim();
  return out || undefined;
}
