> ## Documentation Index
> Fetch the complete documentation index at: https://docs.gnani.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# JSON output

> Get replies as JSON that your code can parse, optionally matching a schema you define.

Early access
**Gnani Evon v3.5** is now available as an API to early access registrants.

When your code, not a person, reads the reply, ask for JSON.

## When to use this

* **Classification**, such as the intent and language of a customer message.
* **Extraction**, such as appointment details from a chat.
* **Any reply your code parses** instead of showing it to a person.

***

## JSON object

Ask for JSON in the prompt, and say which keys you want:

Set up the client once. The examples on this page use `client` from here. Your API key is read from the `GNANI_API_KEY` environment variable. The Python examples below the setup are written for the OpenAI SDK, and work unchanged with the Gnani SDK client (`GnaniLLMClient`). With `AsyncGnaniLLMClient`, add `await` to each call. See the [Python SDK](https://docs.gnani.ai/python-sdk/llm.md) page.

```python Python (OpenAI SDK) theme={null}
import os
from openai import OpenAI

client = OpenAI(
    base_url="https://api.vachana.ai/v1",
    api_key=os.environ["GNANI_API_KEY"],
)
```

```python Python (Gnani SDK) theme={null}
# pip install "gnani-vachana[llm]"
from gnani.llm import GnaniLLMClient

client = GnaniLLMClient()  # reads GNANI_API_KEY
```

```python Python (Gnani SDK, async) theme={null}
# pip install "gnani-vachana[llm]"
from gnani.llm import AsyncGnaniLLMClient

client = AsyncGnaniLLMClient()  # reads GNANI_API_KEY
# call it with await: await client.chat.completions.create(...)
```

```javascript JavaScript (OpenAI SDK) theme={null}
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.vachana.ai/v1",
  apiKey: process.env.GNANI_API_KEY,
});
```

```bash cURL highlight={8} theme={null}
curl https://api.vachana.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-API-Key-ID: $GNANI_API_KEY" \
  -d '{
    "model": "evon-v3.5",
    "reasoning_effort": "none",
    "temperature": 0,
    "response_format": {"type": "json_object"},
    "messages": [
      {"role": "system", "content": "Classify the customer message. Reply in JSON with the keys \"intent\" (one of: refund, delivery, other) and \"language\" (an ISO 639-1 code)."},
      {"role": "user", "content": "मेरा पार्सल अभी तक नहीं आया"}
    ]
  }'
```

```python Python (OpenAI SDK) highlight={7} theme={null}
import json

completion = client.chat.completions.create(
    model="evon-v3.5",
    reasoning_effort="none",
    temperature=0,
    response_format={"type": "json_object"},
    messages=[
        {"role": "system", "content": 'Classify the customer message. Reply in JSON with the keys "intent" '
                                      '(one of: refund, delivery, other) and "language" (an ISO 639-1 code).'},
        {"role": "user", "content": "मेरा पार्सल अभी तक नहीं आया"},
    ],
)

choice = completion.choices[0]
if choice.finish_reason != "stop":
    raise RuntimeError(f"Incomplete reply: {choice.finish_reason}")
result = json.loads(choice.message.content)
print(result["intent"])   # delivery
```

```javascript JavaScript (OpenAI SDK) highlight={5} theme={null}
const completion = await client.chat.completions.create({
  model: "evon-v3.5",
  reasoning_effort: "none",
  temperature: 0,
  response_format: { type: "json_object" },
  messages: [
    {
      role: "system",
      content: 'Classify the customer message. Reply in JSON with the keys "intent" ' +
        '(one of: refund, delivery, other) and "language" (an ISO 639-1 code).',
    },
    { role: "user", content: "मेरा पार्सल अभी तक नहीं आया" },
  ],
});

const choice = completion.choices[0];
if (choice.finish_reason !== "stop") {
  throw new Error(`Incomplete reply: ${choice.finish_reason}`);
}
const result = JSON.parse(choice.message.content);
console.log(result.intent);   // delivery
```

```python Python (requests) highlight={11} theme={null}
import os
import requests

response = requests.post(
    "https://api.vachana.ai/v1/chat/completions",
    headers={"X-API-Key-ID": os.environ["GNANI_API_KEY"]},
    json={
        "model": "evon-v3.5",
        "reasoning_effort": "none",
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": 'Classify the customer message. Reply in JSON with the keys "intent" '
                                          '(one of: refund, delivery, other) and "language" (an ISO 639-1 code).'},
            {"role": "user", "content": "मेरा पार्सल अभी तक नहीं आया"},
        ],
    },
    timeout=60,
)
response.raise_for_status()
choice = response.json()["choices"][0]
if choice["finish_reason"] != "stop":
    raise RuntimeError(f"Incomplete reply: {choice['finish_reason']}")
print(choice["message"]["content"])
```

The reply's `content`:

```json theme={null}
{"intent": "delivery", "language": "hi"}
```

***

## How it works

Set `response_format`:

| `response_format` | What you get |
| - | - |
| `{"type": "text"}` | Plain text. The default. |
| `{"type": "json_object"}` | A valid JSON object. You describe the keys in your prompt. |
| `{"type": "json_schema", "json_schema": {...}}` | JSON that follows the schema you send. |

The JSON is in `message.content`, as a string. Parse it with your JSON library.

***

## JSON schema

To make the keys and types exact, send a [JSON Schema](https://json-schema.org/understanding-json-schema). `json_schema.name` is required.

```bash cURL expandable highlight={12-15} theme={null}
curl https://api.vachana.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-API-Key-ID: $GNANI_API_KEY" \
  -d '{
    "model": "evon-v3.5",
    "reasoning_effort": "none",
    "temperature": 0,
    "messages": [
      {"role": "system", "content": "Extract the appointment details from the message."},
      {"role": "user", "content": "Can I see Dr. Rao on Friday at 4 pm? It'\''s for my knee."}
    ],
    "response_format": {
      "type": "json_schema",
      "json_schema": {
        "name": "appointment",
        "schema": {
          "type": "object",
          "properties": {
            "doctor": {"type": "string"},
            "day": {"type": "string"},
            "time": {"type": "string"},
            "reason": {"type": "string"}
          },
          "required": ["doctor", "day", "time", "reason"],
          "additionalProperties": false
        }
      }
    }
  }'
```

```python Python (OpenAI SDK) expandable highlight={11-14} theme={null}
import json

completion = client.chat.completions.create(
    model="evon-v3.5",
    reasoning_effort="none",
    temperature=0,
    messages=[
        {"role": "system", "content": "Extract the appointment details from the message."},
        {"role": "user", "content": "Can I see Dr. Rao on Friday at 4 pm? It's for my knee."},
    ],
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "appointment",
            "schema": {
                "type": "object",
                "properties": {
                    "doctor": {"type": "string"},
                    "day": {"type": "string"},
                    "time": {"type": "string"},
                    "reason": {"type": "string"},
                },
                "required": ["doctor", "day", "time", "reason"],
                "additionalProperties": False,
            },
        },
    },
)

choice = completion.choices[0]
if choice.finish_reason != "stop":
    raise RuntimeError(f"Incomplete reply: {choice.finish_reason}")
appointment = json.loads(choice.message.content)
print(appointment["doctor"], appointment["day"], appointment["time"])
```

```javascript JavaScript (OpenAI SDK) expandable highlight={9-12} theme={null}
const completion = await client.chat.completions.create({
  model: "evon-v3.5",
  reasoning_effort: "none",
  temperature: 0,
  messages: [
    { role: "system", content: "Extract the appointment details from the message." },
    { role: "user", content: "Can I see Dr. Rao on Friday at 4 pm? It's for my knee." },
  ],
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "appointment",
      schema: {
        type: "object",
        properties: {
          doctor: { type: "string" },
          day: { type: "string" },
          time: { type: "string" },
          reason: { type: "string" },
        },
        required: ["doctor", "day", "time", "reason"],
        additionalProperties: false,
      },
    },
  },
});

const choice = completion.choices[0];
if (choice.finish_reason !== "stop") {
  throw new Error(`Incomplete reply: ${choice.finish_reason}`);
}
const appointment = JSON.parse(choice.message.content);
console.log(appointment.doctor, appointment.day, appointment.time);
```

With OpenAI's Python SDK you can also pass a Pydantic model to `client.chat.completions.parse(...)`, which builds the schema and parses the reply for you.

***

## Gotchas and tips

> [!WARNING]
>
> **Personal data is masked in replies.** A phone number, email or ID that the model writes into the JSON is replaced with a placeholder such as `[REDACTED_PHONE]`. See [Safety and privacy](https://docs.gnani.ai/api/LLM/safety.md#personal-data-in-replies).

* **Check `finish_reason` before parsing.** If it is `length`, the reply was cut off at `max_tokens` and the JSON is incomplete. Raise `max_tokens` or ask for less.
* **Turn thinking off** (`"reasoning_effort": "none"`) for extraction and classification. It is faster, and leaves the whole `max_tokens` budget for the JSON. See [Thinking](https://docs.gnani.ai/api/LLM/thinking.md).
* **Use `temperature: 0`** when you want the same input to give the same output.
* **Validate the result.** Check the values, not only the keys, before you act on them.

***

## Related

> [card] [Tool calling](https://docs.gnani.ai/api/LLM/tool-calling.md)
>
> Let the model call your functions with JSON arguments.

> [card] [Thinking](https://docs.gnani.ai/api/LLM/thinking.md)
>
> Turn thinking off for faster extraction.

> [card] [Safety and privacy](https://docs.gnani.ai/api/LLM/safety.md)
>
> How personal data in replies is masked.

> [card] [Chat Completions](https://docs.gnani.ai/api/LLM/chat-completions.md)
>
> Every request field, including `response_format`.


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.