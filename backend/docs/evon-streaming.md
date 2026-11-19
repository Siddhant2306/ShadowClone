> ## Documentation Index
> Fetch the complete documentation index at: https://docs.gnani.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Streaming

> Show the model's reply while it is being written, using Server-Sent Events.

Early access
**Gnani Evon v3.5** is now available as an API to early access registrants.Without streaming, you get the reply only when the model has finished writing it. With streaming, the reply arrives in small pieces as it is written, so your app can show the first words almost at once.## When to use this- **Chat interfaces**, where waiting for the full reply feels slow.
- **Voice agents**, where the first words should reach the user as soon as possible.
- **Long replies** that you want to show as they are written.```bash cURL highlight={7} theme={null}
# -N shows each event as soon as it arrives
curl -N https://api.vachana.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-API-Key-ID: $GNANI_API_KEY" \
  -d '{
    "model": "evon-v3.5",
    "stream": true,
    "reasoning_effort": "none",
    "messages": [{"role": "user", "content": "Explain UPI in three sentences."}]
  }'
``````python Python (OpenAI SDK) highlight={12} theme={null}
import os
from openai import OpenAI

client = OpenAI(
    base_url="https://api.vachana.ai/v1",
    api_key=os.environ["GNANI_API_KEY"],
)

stream = client.chat.completions.create(
    model="evon-v3.5",
    messages=[{"role": "user", "content": "Explain UPI in three sentences."}],
    stream=True,
    stream_options={"include_usage": True},
    reasoning_effort="none",
)

for chunk in stream:
    if not chunk.choices:            # the usage chunk
        print("\n", chunk.usage)
        continue
    text = chunk.choices[0].delta.content
    if text:
        print(text, end="", flush=True)
``````python Python (Gnani SDK) highlight={9} theme={null}
# pip install "gnani-vachana[llm]"
from gnani.llm import GnaniLLMClient

client = GnaniLLMClient()  # reads GNANI_API_KEY

stream = client.chat.completions.create(
    model="evon-v3.5",
    messages=[{"role": "user", "content": "Explain UPI in three sentences."}],
    stream=True,
    stream_options={"include_usage": True},
    reasoning_effort="none",
)

for chunk in stream:
    if not chunk.choices:            # the usage chunk
        print("\n", chunk.usage)
        continue
    text = chunk.choices[0].delta.content
    if text:
        print(text, end="", flush=True)
``````python Python (Gnani SDK, async) highlight={12} theme={null}
# pip install "gnani-vachana[llm]"
import asyncio
from gnani.llm import AsyncGnaniLLMClient


async def main():
    client = AsyncGnaniLLMClient()  # reads GNANI_API_KEY

    stream = await client.chat.completions.create(
        model="evon-v3.5",
        messages=[{"role": "user", "content": "Explain UPI in three sentences."}],
        stream=True,
        stream_options={"include_usage": True},
        reasoning_effort="none",
    )

    async for chunk in stream:
        if not chunk.choices:        # the usage chunk
            print("\n", chunk.usage)
            continue
        text = chunk.choices[0].delta.content
        if text:
            print(text, end="", flush=True)


asyncio.run(main())
``````javascript JavaScript (OpenAI SDK) highlight={11} theme={null}
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.vachana.ai/v1",
  apiKey: process.env.GNANI_API_KEY,
});

const stream = await client.chat.completions.create({
  model: "evon-v3.5",
  messages: [{ role: "user", content: "Explain UPI in three sentences." }],
  stream: true,
  reasoning_effort: "none",
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
}
``````python Python (requests) highlight={10,14} theme={null}
import json
import os
import requests

with requests.post(
    "https://api.vachana.ai/v1/chat/completions",
    headers={"X-API-Key-ID": os.environ["GNANI_API_KEY"]},
    json={
        "model": "evon-v3.5",
        "stream": True,
        "reasoning_effort": "none",
        "messages": [{"role": "user", "content": "Explain UPI in three sentences."}],
    },
    stream=True,
    timeout=300,
) as response:
    response.raise_for_status()
    for line in response.iter_lines(decode_unicode=True):
        if not line or not line.startswith("data: "):
            continue
        data = line[len("data: "):]
        if data == "[DONE]":
            break
        event = json.loads(data)
        if "error" in event:                       # the stream failed part-way
            raise RuntimeError(event["error"]["message"])
        if event["choices"]:
            print(event["choices"][0]["delta"].get("content") or "", end="", flush=True)
``````text Stream wrap theme={null}
data: {"id":"chatcmpl-3d9a","object":"chat.completion.chunk","created":1794390000,"model":"evon-v3.5","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}

data: {"id":"chatcmpl-3d9a","object":"chat.completion.chunk","created":1794390000,"model":"evon-v3.5","choices":[{"index":0,"delta":{"content":"UPI (Unified Payments Interface)"},"finish_reason":null}]}

data: {"id":"chatcmpl-3d9a","object":"chat.completion.chunk","created":1794390000,"model":"evon-v3.5","choices":[{"index":0,"delta":{"content":" is India's real-time payment system."},"finish_reason":null}]}

data: {"id":"chatcmpl-3d9a","object":"chat.completion.chunk","created":1794390000,"model":"evon-v3.5","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```## Turn on streamingStreaming uses the same endpoint and request body. Add `"stream": true`:```json highlight={3} theme={null}
{
  "model": "evon-v3.5",
  "stream": true,
  "messages": [{"role": "user", "content": "Explain UPI in three sentences."}]
}
```The full request in each language, and the stream it returns, are in the example panel.***## What the stream looks likeThe response is `200 OK` with `Content-Type: text/event-stream`. Each event is a line starting with `data: `, followed by a blank line. The last event is `data: [DONE]`.To rebuild the reply, join every `choices[0].delta.content` in order.| Field in each chunk | Meaning |
| - | - |
| `choices[0].delta.content` | The next piece of the reply. Can be empty or missing. |
| `choices[0].delta.reasoning` | The next piece of the model's thinking, when thinking is on. It arrives before the reply. See [Thinking](https://docs.gnani.ai/api/LLM/thinking.md). |
| `choices[0].delta.tool_calls` | Pieces of a function call. See [Tool calling](https://docs.gnani.ai/api/LLM/tool-calling.md). |
| `choices[0].finish_reason` | `null` until the last chunk. Then `stop`, `length`, `tool_calls` or `content_filter`, as in a [non-streamed reply](https://docs.gnani.ai/api/LLM/chat-completions.md#response). |### Watch a stream, event by event

Step

        
Reset

        
Speed

        
        
          
Thinking on

        
Event  of


      \<ol aria-label="Event order" />
      
      

Raw events


          

Raw server-sent events received so far


        

What your app has built


          \<dl><dt>role</dt>
            \<dd />
            
            
            \<dt>content</dt>
            \<dd />
            \<dt>finish_reason</dt>
            \<dd />
            \<dt>usage</dt>
            \<dd />
            \<dt>stream</dt>
            \<dd /></dl>

A recorded stream arrives in this order: a chunk with `delta.role`, then `delta.reasoning` chunks if thinking is on, then `delta.content` chunks, then a chunk with `finish_reason`, then a `usage` chunk if `stream_options.include_usage` is true, then `data: [DONE]`.***## Options### Token usageStreamed replies do not include `usage` unless you ask for it. Send `"stream_options": {"include_usage": true}` to get one more chunk before `[DONE]`. Its `choices` list is empty and it carries `usage`:```text wrap theme={null}
data: {"id":"chatcmpl-3d9a","object":"chat.completion.chunk","created":1794390000,"model":"evon-v3.5","choices":[],"usage":{"prompt_tokens":36,"completion_tokens":54,"total_tokens":90}}

data: [DONE]
```> [!TIP]
>
> If you read `choices[0]` in your code, check first that `choices` is not empty.### Showing the thinkingWhen thinking is on, the thinking streams first in `delta.reasoning` and the answer follows in `delta.content`. OpenAI's SDKs do not have a typed field for it, but they keep it on the delta:```python Python (OpenAI SDK) highlight={5} theme={null}
for chunk in stream:
    if not chunk.choices:
        continue
    delta = chunk.choices[0].delta
    thinking = getattr(delta, "reasoning", None)
    if thinking:
        print(thinking, end="", flush=True)      # for example, show it greyed out
    if delta.content:
        print(delta.content, end="", flush=True)
``````javascript JavaScript (OpenAI SDK) highlight={4} theme={null}
for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta;
  if (!delta) continue;
  if (delta.reasoning) {
    process.stdout.write(delta.reasoning);       // for example, show it greyed out
  }
  if (delta.content) {
    process.stdout.write(delta.content);
  }
}
```***## Errors**Before the stream starts**, errors are ordinary HTTP responses with an error status: a bad parameter, a request refused by the safety filters, a rate limit, and so on. Your code sees them before any event. See [Errors](https://docs.gnani.ai/api/LLM/errors.md).**After the stream has started**, the status is already `200` and cannot change. If the model fails part-way, you receive one last event with the usual error object, and the stream ends without `[DONE]`:```text wrap theme={null}
data: {"error":{"message":"The model stopped responding mid-stream.","type":"server_error","param":null,"code":"upstream_error"}}
```> [!WARNING]
>
> OpenAI's SDKs raise an `APIError` for this event. Treat a stream that ends without `[DONE]` as failed, and decide whether to keep or discard the text you have shown.To check for `[DONE]` yourself in JavaScript, read the raw stream:```javascript detect_incomplete_stream.mjs expandable highlight={30,38-41} theme={null}
const response = await fetch("https://api.vachana.ai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key-ID": process.env.GNANI_API_KEY,
  },
  body: JSON.stringify({
    model: "evon-v3.5",
    stream: true,
    reasoning_effort: "none",
    messages: [{ role: "user", content: "Explain UPI in three sentences." }],
  }),
});
if (!response.ok) {
  throw new Error(`HTTP ${response.status}: ${await response.text()}`);  // failed before the stream started
}

const decoder = new TextDecoder();
let buffer = "";
let finished = false;

for await (const bytes of response.body) {
  buffer += decoder.decode(bytes, { stream: true });
  const lines = buffer.split("\n");
  buffer = lines.pop();                       // keep a partial line for the next read
  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    if (!line.startsWith("data: ")) continue;
    const data = line.slice("data: ".length);
    if (data === "[DONE]") { finished = true; break; }
    const event = JSON.parse(data);
    if (event.error) throw new Error(event.error.message);   // failed part-way
    process.stdout.write(event.choices[0]?.delta?.content ?? "");
  }
  if (finished) break;
}

if (!finished) {
  // The connection closed without [DONE]: treat the reply as failed.
  throw new Error("The stream ended without [DONE].");
}
```> [!NOTE]
>
> Personal data in the reply is masked while it streams (see [Safety and privacy](https://docs.gnani.ai/api/LLM/safety.md)). To catch a phone number or ID split across two chunks, a few characters are briefly held back, so text can arrive in slightly uneven pieces.***## Related> [card] [Chat Completions](https://docs.gnani.ai/api/LLM/chat-completions.md)
>
> Every request field and the non-streamed response.> [card] [Thinking](https://docs.gnani.ai/api/LLM/thinking.md)
>
> How `delta.reasoning` arrives before the answer.> [card] [Tool calling](https://docs.gnani.ai/api/LLM/tool-calling.md)
>
> Stream tool calls and join them by `index`.> [card] [Errors](https://docs.gnani.ai/api/LLM/errors.md)
>
> Error codes, and how to retry safely.


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.