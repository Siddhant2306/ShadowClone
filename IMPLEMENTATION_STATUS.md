
## Ollama reasoning restored
The DeepSeek connection has been removed. Reasoning uses local Ollama with qwen3:4b. The improved purpose prompt remains in backend/app/reasoning.py. Gnani voice, routes, database and UI are preserved. Keep Ollama running and restart the backend.

## Twilight visual refresh
Added frontend/src/twilight.css as a dedicated presentation layer and frontend/public/art/twilight.svg as original local artwork. The style follows the supplied reference's parchment, indigo, apricot and lavender palette, rounded cards and calm typography. Landing page, authentication, navigation, overview, profiles, memories, voice and conversation screens share the theme. No backend or provider changes are part of this visual refresh. Landing-page rendering was visually checked; authenticated pages still need a signed-in visual pass. Production frontend build verified.
