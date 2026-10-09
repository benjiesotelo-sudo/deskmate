# Data contract

These are the shapes the core serves.
The office module and the Google module build on them.
Every `/api` route needs a signed-in session cookie and answers `401` with `{ "error": "..." }` without one.
Errors always come back as `{ "error": "a sentence a person can read" }`.

TypeScript versions of every shape are exported from `web/src/lib/api.ts`.

## People

`GET /api/people`

```ts
type Person = {
  id: string;
  username: string;
  name: string;
  role: string;                 // job title, for display
  access: "admin" | "staff";
  email: string;
  location: "office" | "home";
  desk: { x: number; y: number };   // grid units on a 12 wide by 8 deep floor, origin top left
  avatar: {
    skin: string;       // hex colour
    hair: string;       // hex colour
    outfit: string;     // hex colour
    accessory: string;  // "none" | "glasses" | "lanyard" | "mug" | "headset" | "notebook"
  };
  owns: { documents: string[]; processes: string[] };   // ids
};
```

The seed file is `data/sample-office/people.json`.
`owns` in the API response is computed from the live records, so it changes the moment a document is handed to someone else.

## Courses

`GET /api/courses`

```ts
type Course = {
  id: string;            // "BUS101"
  title: string;
  term: string;
  coordinator: string;   // person id
  chapters: { number: number; title: string }[];
};
```

Documents that belong to the office and not to a course use the course id `OFFICE`.

## Processes

`GET /api/processes` and `GET /api/processes/:id`

```ts
type OfficeProcess = {
  id: string;
  name: string;
  owner: string;      // person id
  summary: string;
  trigger: string;
  example: string;
  steps: {
    id: string;
    title: string;
    kind: "start" | "task" | "decision" | "end";
    actor: string;       // person id
    description: string;
    example: string;
    artifact?: string;   // document id
    next: string[];      // step ids; a decision has two, an end has none
  }[];
};
```

The seed file is `data/sample-office/processes.json`.
The four seeded ids are `file-course-material`, `release-quiz`, `accreditation-check` and `staff-handover`.

## Documents

`GET /api/documents?course=&chapter=&kind=&status=&owner=&scope=`

- `chapter` is a number, or `none` for course-wide documents.
- `scope=mine` limits the list to documents the signed-in person owns.

```ts
type DocRecord = {
  id: string;            // "fin201-ch01-quiz-v1"
  title: string;
  kind: "syllabus" | "materials" | "quiz" | "deck" | "book" | "process" | "other";
  course: string;
  term: string;
  chapter: number | null;
  owner: string;         // person id
  version: number;
  status: "draft" | "current" | "superseded";
  path: string;          // relative to the office folder
  updatedAt: string;     // ISO date
};
```

`GET /api/documents/:id` returns the record plus `text`, `fileName`, `fileExists`, `versions` (the other versions of the same document) and `canEdit`.

`GET /api/documents/:id/file` downloads the original file.

`PATCH /api/documents/:id` accepts any of `title`, `kind`, `course`, `term`, `chapter`, `owner`, `version`, `status`.
An admin can edit any record. Staff can edit records they own. Only an admin can change `owner`.
Marking a document `current` marks any other current document in the same course, chapter and kind as `superseded`; their ids come back in `superseded`.

`POST /api/documents` files a new document.
Send `title`, `kind`, `course`, `chapter`, `owner`, `status`, and either `text` or `fileName` with `contentBase64`.

`GET /api/filing/advice?course=&chapter=&kind=&title=&extension=` answers "Where does this go?" without filing anything.

## Readiness

`GET /api/readiness`

```ts
type Readiness = {
  present: number;
  required: number;
  score: number;      // whole percent
  courses: {
    id: string; title: string; term: string; coordinator: string;
    present: number; required: number; score: number;
    slots: Slot[];    // every required document
    gaps: Slot[];     // the ones that are not current
  }[];
};
type Slot = {
  course: string;
  chapter: number | null;
  chapterTitle: string | null;
  kind: "syllabus" | "deck" | "materials" | "quiz";
  state: "current" | "draft" | "superseded" | "missing";
  docId: string | null;
  version: number | null;
  duplicates: string[];
};
```

## Tams

`POST /api/tams/chat`

Request: `{ messages: [{ role: "user" | "assistant", content: string }], mode: "local" | "cloud" }`.
The last message must be from the user.

Response: `text/plain`, streamed.
The answer text arrives as it is written.
When it is complete, one record separator character (`0x1E`) follows, then one JSON frame:

```ts
type TamsFrame = {
  sources: { docId: string; title: string; n: number }[];          // documents the answer cites
  processId?: string;                                              // set when a documented process answers the question
  processes: { processId: string; title: string; n: number }[];   // processes the answer cites
  mode: "local" | "cloud";       // the mode that actually answered
  model: string;                 // "qwen3:4b", "claude-sonnet-5-5", or "lookup" when no model was running
  retrieval: "embeddings" | "keywords" | "none";
  notice?: string;               // for example, cloud mode fell back to local
  error?: string;
};
```

`n` is the number used for citations like `[1]` inside the answer text.
When `processId` is present, link to `/office?play=<processId>`.
`web/src/lib/tams.ts` has a ready client: `askTams(messages, mode, onText)`.

`GET /api/tams/status` reports whether Ollama, the two local models, cloud mode and the index are ready.

## Sign-in

- `POST /auth/login` with `{ username, password }` sets an HTTP-only cookie named `deskmate_session`.
- `POST /auth/logout` clears it.
- `GET /api/me` returns `{ person, office }`; `person` is `null` when signed out.
- `GET /auth/google` and `GET /auth/google/status` live in `server/src/google.ts`.
  Today they report that Google sign-in is not switched on.
  The Google module replaces those handlers and calls `startSession(res, personId)` from `server/src/auth.ts` after Google confirms the person.

## Web routes

- `/office` and `/processes/:id` are reserved for the office module.
  They are registered in `web/src/App.tsx` and render `web/src/pages/ComingSoon.tsx` until the module replaces them.
- `web/src/office/` and `web/src/processes/` are left empty for that module.
- Stage screens get the deep background from the shell: add the route prefix to `STAGE_PATHS` in `web/src/components/Shell.tsx`.
- Shared pieces: tokens in `web/src/styles/tokens.css`, the mascot in `web/src/components/Tams.tsx`, API types and `api()` in `web/src/lib/api.ts`.
