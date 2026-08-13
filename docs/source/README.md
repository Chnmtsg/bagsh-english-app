# Source documents

The three documents this application was built from, kept verbatim:

- `English-Teacher-Bot-Prompt.md` — the original teacher-bot system prompt
  (learner profile, the 14 Mongolian-transfer systems, response structure).
- `Bagsh-System-Prompt-v2.md` — the master tutor spec v2.0 (30 interference
  codes, strictness, fossilisation, determinism boundary, API rules).
  Its teaching behaviour is implemented per ADR-0004; its single-call JSON
  architecture was rejected per ADR-0001.
- `English-Mongolian-Contrastive-Guide.docx` — the five-volume contrastive
  guide. The extracted text lives at `knowledge/contrastive-guide.md`, which
  is what `guide_ref` citations point into.
