> ## Documentation Index
> Fetch the complete documentation index at: https://docs.gnani.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Quickstart

> Get an API key and send your first request to the LLM API in a few minutes.

Early access
**Gnani Evon v3.5** is now available as an API to early access registrants.This page takes you from no key to a working reply. You need a terminal, and Python 3 or Node.js if you want to use an SDK. For Python you can use OpenAI's SDK, or Gnani's own `gnani-vachana` SDK, which has a sync and an async client (install it with `pip install "gnani-vachana[llm]"`). See the [Python SDK](https://docs.gnani.ai/python-sdk/llm.md) page.**1. Get an API key**Create a key in the [Gnani API dashboard](https://app.gnani.ai/voice). The key must have access to the LLM API; a key without it gets `403 SCOPE_NOT_ALLOWED`.**2. Set the key as an environment variable**Keep the key out of your code. The examples on this page read it from `GNANI_API_KEY`:```bash theme={null}
export GNANI_API_KEY="<your-api-key>"
```**3. Send a message**```bash cURL highlight={9} theme={null}
curl https://api.vachana.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-API-Key-ID: $GNANI_API_KEY" \
  -d '{
    "model": "evon-v3.5",
    "messages": [
      {"role": "user", "content": "Say hello in Hindi."}
    ],
    "reasoning_effort": "none"
  }'
``````python Python (OpenAI SDK) highlight={13} theme={null}
# pip install openai
import os
from openai import OpenAI

client = OpenAI(
    base_url="https://api.vachana.ai/v1",
    api_key=os.environ["GNANI_API_KEY"],
)

completion = client.chat.completions.create(
    model="evon-v3.5",
    messages=[{"role": "user", "content": "Say hello in Hindi."}],
    reasoning_effort="none",
)
print(completion.choices[0].message.content)
``````python Python (Gnani SDK) highlight={10} theme={null}
# pip install "gnani-vachana[llm]"
# The key is read from GNANI_API_KEY. See /python-sdk/llm for the async client.
from gnani.llm import GnaniLLMClient

client = GnaniLLMClient()

completion = client.chat.completions.create(
    model="evon-v3.5",
    messages=[{"role": "user", "content": "Say hello in Hindi."}],
    reasoning_effort="none",
)
print(completion.choices[0].message.content)
``````python Python (Gnani SDK, async) highlight={12} theme={null}
# pip install "gnani-vachana[llm]"
import asyncio
from gnani.llm import AsyncGnaniLLMClient


async def main():
    client = AsyncGnaniLLMClient()

    completion = await client.chat.completions.create(
        model="evon-v3.5",
        messages=[{"role": "user", "content": "Say hello in Hindi."}],
        reasoning_effort="none",
    )
    print(completion.choices[0].message.content)


asyncio.run(main())
``````javascript JavaScript (OpenAI SDK) highlight={12} theme={null}
// npm install openai
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.vachana.ai/v1",
  apiKey: process.env.GNANI_API_KEY,
});

const completion = await client.chat.completions.create({
  model: "evon-v3.5",
  messages: [{ role: "user", content: "Say hello in Hindi." }],
  reasoning_effort: "none",
});
console.log(completion.choices[0].message.content);
``````python Python (requests) highlight={11} theme={null}
# pip install requests
import os
import requests

response = requests.post(
    "https://api.vachana.ai/v1/chat/completions",
    headers={"X-API-Key-ID": os.environ["GNANI_API_KEY"]},
    json={
        "model": "evon-v3.5",
        "messages": [{"role": "user", "content": "Say hello in Hindi."}],
        "reasoning_effort": "none",
    },
    timeout=120,
)
response.raise_for_status()
print(response.json()["choices"][0]["message"]["content"])
```> [!NOTE]
>
> **The model thinks before it answers, by default.** Thinking counts toward `max_tokens`, which is 1,024 on Free and Pay-as-you-go plans, so a first request with thinking on can come back with empty `content` and `finish_reason: "length"`. These examples send `"reasoning_effort": "none"` to turn thinking off. To turn it on, leave the field out. See [Thinking](https://docs.gnani.ai/api/LLM/thinking.md).**4. Read the reply**The answer is in `choices[0].message.content`. `usage` shows the tokens the request used.```json theme={null}
{
  "id": "chatcmpl-6b1f4f0c2a5e4d8b",
  "object": "chat.completion",
  "created": 1794390000,
  "model": "evon-v3.5",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "नमस्ते! आप कैसे हैं?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 38,
    "completion_tokens": 9,
    "total_tokens": 47
  }
}
```> [accordion] The same reply with thinking on
>
> Without `reasoning_effort`, the model's thinking comes back in `message.reasoning`, apart from the answer. It counts as output tokens.
>
> ```json wrap theme={null}
> {
>   "choices": [
>     {
>       "index": 0,
>       "message": {
>         "role": "assistant",
>         "content": "नमस्ते! आप कैसे हैं?",
>         "reasoning": "The user wants a greeting in Hindi. A friendly one is \"नमस्ते! आप कैसे हैं?\""
>       },
>       "finish_reason": "stop"
>     }
>   ],
>   "usage": {
>     "prompt_tokens": 38,
>     "completion_tokens": 41,
>     "total_tokens": 79
>   }
> }
> ```## If something goes wrong| What you see | What to do |
| - | - |
| `401` `MISSING_API_KEY` or `INVALID_API_KEY` | Check that `GNANI_API_KEY` is set in the same terminal, and that the key is correct. |
| `403` `SCOPE_NOT_ALLOWED` | Use a key with access to the LLM API. |
| Empty `content` and `finish_reason: "length"` | Thinking used up the reply budget. Send `"reasoning_effort": "none"`. |
| `429` | You sent requests too quickly, or used up your daily tokens. See [Limits](https://docs.gnani.ai/api/LLM/limits.md). |All error codes are on the [Errors](https://docs.gnani.ai/api/LLM/errors.md) page.## Pick settings for your use caseChoose what you are building to see the settings to start with, and a request you can copy.

Use case


      

\<table><caption>Recommended settings:</caption>
          \<thead><tr><th scope="col">Field</th>
              \<th scope="col">Value</th>
              \<th scope="col">Why</th></tr></thead>
          \<tbody /></table>


      

Code language


      \<pre tabIndex={0} />

Starting settings by use case. Voice agent: `"reasoning_effort": "none"`, `"stream": true`, a small `max_tokens`. Extraction: `"reasoning_effort": "none"`, `"temperature": 0`, `response_format` with `json_schema` (see [JSON output](https://docs.gnani.ai/api/LLM/structured-outputs.md)). Chat UI: `"stream": true`, `stream_options.include_usage`, `"reasoning_effort": "none"`. Reasoning task: leave thinking on and set `reasoning_budget` (see [Thinking](https://docs.gnani.ai/api/LLM/thinking.md)).## Next steps> [card] [Chat Completions reference](https://docs.gnani.ai/api/LLM/chat-completions.md)
>
> Every request parameter, the response, and code examples.> [card] [Streaming](https://docs.gnani.ai/api/LLM/streaming.md)
>
> Show the reply word by word while the model writes it.> [card] [Thinking](https://docs.gnani.ai/api/LLM/thinking.md)
>
> When to turn thinking on, and what it costs.> [card] [Migrating from OpenAI](https://docs.gnani.ai/api/LLM/openai-compatibility.md)
>
> Move existing OpenAI code by changing two lines.


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.