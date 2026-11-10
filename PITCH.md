# Shadow Clone

**A voice AI delegate for the meetings you can’t fully attend.**

*Project pitch for Gnani AI’s Great Indian AI Internship Challenge*

## The problem

It’s 11 a.m. and your client call overlaps with the engineering stand-up. The team needs two things from you. Where is the latest build? Can we promise it to the client on Friday? The first question has a known answer. The second needs your judgment. When both have to wait, work stalls. Shadow Clone is designed for project leads, founders, and engineers on small teams who field these questions across overlapping calls.

## The product

Before a meeting, you confirm what Shadow Clone should know, add context for that call, and explicitly consent to enrolling a revocable voice sample. You start the assistant from a shared Google Meet tab. It plays a spoken AI disclosure before listening and identifies itself as AI in every spoken reply. It can tell teammates where the build is using the context you supplied. If it flags the Friday commitment for approval, it withholds the proposed reply and asks for your input. You can review the transcript afterward.

## Where Gnani AI fits

**Gnani Prisma v3.0** transcribes meeting audio using Indic automatic language detection. **Gnani’s Voice Clone Embeddings and Voice Clone Inference APIs** turn an enrolled sample into a speaker embedding and synthesize replies in that voice. Between those steps, an Ollama-hosted model drafts a reply using the transcript, confirmed memories, and meeting context. For Indian teams that switch between Hindi and English mid-sentence, a useful next test is whether the system preserves names, dates, and commitments in code-mixed speech.

## What’s built and how to evaluate it

The prototype includes profile and memory setup, consent-based voice enrollment and revocation, a text simulator with approval on every draft, and a live Google Meet workflow. The live path uses Chrome tab capture and a manually configured virtual audio cable. End-to-end calls against Gnani’s live APIs still need verification.

An evaluation can use the two questions above. Check whether the routine answer matches the supplied context, whether the proposed commitment is withheld, and whether everyone hears the AI disclosure. Those checks tell us whether Shadow Clone can save the team a follow-up while keeping commitments with the person who owns them.

[Run the prototype](README.md) · [Gnani API integration](backend/docs/GNANI_INTEGRATION.md)
