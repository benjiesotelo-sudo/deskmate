# Deskmate

The colleague at the next desk.

Deskmate is a local-first office app.
It keeps an office's documents filed the same way no matter who filed them.
It writes down the office's processes with real examples.
It onboards newcomers through Tams, a bull who answers from the office's own documents using a model that runs on the machine itself.
It keeps working when the internet is gone.

Built for the App Builders PH Local AI Hackathon, 9 to 10 October 2026.
Theme: Local AI - an AI product that stays useful when the cloud disappears.

## The problem

An academic office holds syllabi, decks, readings, quizzes and book records for every course.
The documentation usually exists, but nobody wants to touch it.
Anyone can rearrange it, so nobody trusts it.
When a staff member leaves, how things are done leaves with them.
New hires, especially first jobbers, are left to guess.
Then accreditation season arrives and the office spends weeks proving that its own documents exist and agree with each other.

## What Deskmate does

- **Filing cabinet.** Every document has one record: course, chapter, kind, term, owner, version and status.
  You browse by course, then chapter, then kind.
  When you file something, "Where does this go?" tells you the exact folder, file name and version, and what it replaces.
- **Accreditation readiness.** For each course Deskmate checks for a current syllabus and, for each chapter, a current deck, materials and quiz.
  It shows a readiness score and names every gap with a link to close it.
  This part is plain counting with no AI, so it is right every time.
- **Tams.** Ask Tams how something is done in this office.
  Tams finds the relevant passages in the office's documents and processes, answers only from them, and names the sources.
  When a documented process answers the question, Tams offers "Show me in the office".
- **The office.** A top-down office with everyone at their desk, or in the "Working from home" strip, and Tams at the front desk.
  Play a process and the work moves from desk to desk, one step at a time, with who does it, the document they use and a real example.
- **Process library.** Every process is drawn as a flow with start, tasks, decisions and end, and as a plain checklist.
  The process owner or an admin can edit the steps, and Tams answers from the new version straight away.
- **One link for everyone.** The account decides what opens.
  An admin sees and edits the whole office.
  A staff account opens on what it owns, can read the rest, and can edit only its own records.

## What you can do

One sentence per screen.

| Screen | Where | What you can do there |
| --- | --- | --- |
| Sign in | `/` when signed out | Sign in with a username or email and a password, or pick one of the demo accounts. |
| Filing cabinet | `/cabinet` | See every course with its document count and readiness, and the documents touched last. |
| Course | `/cabinet/BUS101` | Browse one course by chapter and filter it by kind of document. |
| Document | `/documents/:id` | Read a document's record, extracted text and versions, download the original, and edit the record if it is yours. |
| File a document | `/cabinet/file` | Attach or write a document and let "Where does this go?" name its folder, file name and version before you file it. |
| Readiness | `/readiness` | Read the accreditation score for the office and each course, and follow a link to close each named gap. |
| Ask Tams | `/tams` | Ask how something is done here and get a cited answer from the local model, with "Show me in the office" when a process answers it. |
| The office | `/office` | See who is in and who is at home, click anyone to see what they own, and play any process to watch the work move from desk to desk. |
| Processes | `/processes` | See every documented process with its owner, its trigger and the people who take part. |
| Process | `/processes/:id` | Read one process as a flow or a checklist, play it step by step, and edit its steps if you own it or are an admin. |
| Settings | `/settings` | Check that Ollama, both models and Tams' index are ready, and see which optional parts would need the internet. |

## Why this runs on local AI

- **Confidential documents never leave the machine.** Quizzes, answer keys and staff records are exactly what an office should not paste into a cloud chatbot.
  In local mode nothing is sent anywhere.
- **It works when the wifi dies.** Sign-in, the cabinet, readiness, the office, the process library and Tams all run on this computer.
  Pull the network cable and ask Tams again: same answer.
- **No cost per question.** A newcomer can ask the same thing ten times without anyone watching a bill.

## What runs where

| Part | Where it runs | Needs internet |
| --- | --- | --- |
| Web app and API (Express, React) | This machine, port 4747 | No |
| Database (SQLite through `node:sqlite`) | This machine, `data/deskmate.sqlite` | No |
| Office documents | This machine, `data/office/` | No |
| Username and password sign-in | This machine | No |
| Text extraction from PDF and Word files | This machine | No |
| Embeddings (`nomic-embed-text` via Ollama) | This machine | No |
| Tams' answers in Local mode (`qwen3:4b` via Ollama) | This machine | No |
| Accreditation readiness | This machine, no model involved | No |
| Office view, process flows and playback | This machine, drawn in the browser with SVG and CSS | No |
| Process edits | This machine, `data/office/processes.json`, re-indexed for Tams on save | No |
| Fonts (Inter) | Bundled with the app | No |
| Tams' answers in Cloud mode (`claude-sonnet-5-5`) | Anthropic API, optional, off by default | Yes |
| Google sign-in and Drive mirror | Google APIs, optional, arriving in a separate module | Yes |
| First-time setup (`npm install`, `ollama pull`) | Downloads once | Yes, once |

Cloud mode is offered in the chat header only when `ANTHROPIC_API_KEY` is set and the network is reachable.
In Cloud mode the passages Tams retrieved are sent to Anthropic to write the answer.
If the cloud call fails, Tams answers locally and says so.
If Ollama itself is not running, Tams still looks the answer up by keyword and shows the passage word for word.

## Disclosures

**Models**

- `qwen3:4b` through Ollama: the local chat model that writes Tams' answers.
- `nomic-embed-text` through Ollama: the local embedding model used to index and search documents.
- `claude-sonnet-5-5` through the Anthropic API: optional Cloud mode only, disabled unless an API key is provided.

**Frameworks and libraries**

- Runtime: Node.js 22.13 or newer, TypeScript, `tsx`.
- Server: Express 5, the built-in `node:sqlite` and `node:crypto` (scrypt password hashing).
- Web: React 19, React Router 7, Vite, Inter through `@fontsource-variable/inter`.
- Documents: `unpdf` for PDF text, `mammoth` for Word text, `pdf-lib` and `docx` to generate the sample files.
- Cloud mode: `@anthropic-ai/sdk`.
- Local model server: Ollama.

**AI development tools**

- Claude Code was used to write and test this project.

**Data**

- Every person, course, process and document in this repository is invented sample data for the "Deskmate Demo Office".
- No real office documents and no real names are included.

## Hardware

**Hardware line:** built and tested on a Mac mini (Apple M4, 16 GB memory, macOS 26.5, Node 26.6, Ollama 0.40); sized for the demo machine, a Mac mini with Apple M2 and 8 GB memory, with every model running on the machine itself.

- With both models loaded Ollama uses about 3.3 GB (2.9 GB for `qwen3:4b`, 0.4 GB for `nomic-embed-text`), which leaves room on an 8 GB machine for the app and a browser.
- On the test machine the first word of a grounded answer arrives in about 1 to 4 seconds and a full process answer takes about 4 to 9 seconds.
- The office view and the process playback are CSS transforms and SVG with one timer and no animation loop, so they stay smooth on a small machine.
- There are no native modules to compile, so `npm install` does not need Xcode or Python.
- Not yet run on the 8 GB M2 itself: that is the one check left for the demo machine.

## Setup

You need a Mac or Linux machine with Node.js 22.13 or newer.

1. Install Ollama from https://ollama.com/download and open it once.
2. Clone this repository and go into it.
3. Run the setup script.
   It checks Node and Ollama, pulls the two local models (about 2.8 GB the first time), and seeds the sample office.

   ```bash
   scripts/setup.sh
   ```

4. Install packages.
   The setup script already does this when `node_modules` is missing, so this is a no-op if it ran cleanly.

   ```bash
   npm install
   ```

5. Start Deskmate.

   ```bash
   npm run dev
   ```

6. Open http://localhost:4747.
7. Sign in with a demo account.

To run the built app instead of the development server:

```bash
npm run build
npm start
```

### Demo accounts

The password for every demo account is `deskmate`.

| Username | Who | What they see |
| --- | --- | --- |
| `marisol` | Marisol Dantes, Office Administrator | Admin: the whole office |
| `celso` | Celso Marquez, Department Chair | Admin: the whole office |
| `rafael` | Rafael Ignacio, coordinator of BUS101 | Staff: their own documents first |
| `lourdes` | Lourdes Abad, coordinator of FIN201 | Staff: their own documents first |
| `jomar` | Jomar Velez, coordinator of MKT150 | Staff: their own documents first |
| `bea` | Bea Soliman, Program Assistant, new hire | Staff: their own documents first |

"Continue with Google" is on the sign-in page.
In this build it reports that Google sign-in is not switched on yet and sends you back to the password form.

## Five-minute demo script

Run the built app (`npm run build && npm start`), open http://localhost:4747, and keep the window at about 1440 by 900.
Every step below was run this way, in Local mode, with no API key on the machine.

1. **Sign in** (20 seconds).
   Click the "Marisol" demo account, then "Sign in".
   She is the office administrator, so she sees the whole office.
2. **Filing cabinet** (40 seconds).
   The cabinet shows 42 documents in four drawers.
   Open FIN201, then the Chapter 1 quiz: one record, the extracted text, and its version.
3. **Readiness** (30 seconds).
   Open Readiness and read the big number: 78 percent, 28 of 36 required documents, with 8 gaps named.
   This is plain counting with no AI.
4. **Ask Tams** (50 seconds).
   Open Ask Tams, check the header says "Local mode", and ask "How do I release a quiz?".
   The answer streams from `qwen3:4b` on this machine: eight steps in order with who does each, the office's own FIN201 example, and the source chip "Release a quiz".
5. **Show me in the office** (50 seconds).
   Press "Show me in the office".
   The process plays in the office: the desk of the person doing each step lights up, a dot carries the work from Lourdes at home to Bea in the office and back, and Tams' speech bubble shows the step, the document and the real example.
   Space pauses, and the arrow keys step forward and back.
6. **The process page** (30 seconds).
   Click the process name in the speech bubble.
   The same process is drawn as a flow, and the Steps tab lists it as a checklist.
7. **Edit a step and save** (50 seconds).
   Open the Edit tab, find "Schedule the release", and add this sentence to its description: "Then message the class representative on the group chat."
   Press "Save process".
   The page answers "Saved. Everyone in the office now sees this version, and Tams answers from it."
8. **It persisted, and Tams knows** (40 seconds).
   Reload the page: the new sentence is still there.
   Open Ask Tams and ask "After I schedule a quiz release, who do I message?".
   Tams answers with the class representative and names "Release a quiz" as a source.
9. **Pull the plug** (optional, 30 seconds).
   Turn the wifi off and ask Tams again.
   Every request the app makes goes to this machine, so nothing changes.

To put the sample office back the way it shipped, stop the app and run `npm run seed -- --reset`.

Other things worth a look if there is time:

- Click anyone in the office to see what they own and which processes they take part in, then "Ask Tams about this".
- Play "File new course material" or "Staff turnover handover" from the "How everything works" chart: the work crosses more desks.
- Sign out and sign in as `bea`, the new hire: the cabinet opens on what she owns, and the process editor lets her try changes but not save them.
- Click "File it" on a gap in Readiness, file the missing document, and watch the score go up.

## Commands

| Command | What it does |
| --- | --- |
| `scripts/setup.sh` | Pulls the Ollama models, installs packages if needed, seeds the sample office and builds the index |
| `npm run dev` | Runs the API and the web app with hot reload on http://localhost:4747 |
| `npm run build` | Type-checks everything and builds the web app into `web/dist` |
| `npm start` | Runs the built app on http://localhost:4747 |
| `npm run seed` | Loads the office folder into the database and indexes it |
| `npm run seed -- --reset` | Throws away local changes and starts again from the sample office |
| `npm run index` | Rebuilds Tams' index: chunks every document and process and embeds them |
| `npm test` | Runs the tests |
| `npm run samples` | Regenerates `data/sample-office` from `scripts/` |

Optional settings are listed in `.env.example`.
Deskmate needs none of them to run.

## How Tams works

1. **Index.** Every document's text and every process is cut into passages of about 800 characters.
   Each passage is embedded with `nomic-embed-text` and stored in SQLite as a JSON vector.
2. **Retrieve.** The question is embedded the same way.
   Passages are ranked by cosine similarity in plain JavaScript, with a small boost for shared keywords.
   Superseded documents are left out, so Tams never answers from an old version.
   If nothing in the office is close enough, Tams gets no passages and says it could not find an answer.
3. **Answer.** `qwen3:4b` receives only the retrieved passages and the question, with instructions to answer from them alone and cite them.
   The answer streams to the browser as it is written.
4. **Show.** The final frame lists the documents that were cited.
   When a documented process is the best match, it also carries that process id, which becomes the "Show me in the office" button.
5. **Stay current.** Filing a document or saving a process edit re-indexes just that document or process, so the next answer uses it.

`qwen3:4b` is a reasoning model that thinks out loud for many seconds before it answers, even when asked not to.
Deskmate sends `think: false` and hands the model an already-finished thought, so the first word arrives in a few seconds instead of twenty.

## Project layout

```
server/src/            Express API, SQLite, sign-in, readiness
server/src/tams/       Tams: chunking, embeddings, retrieval, local and cloud chat
server/src/google.ts   The seam for Google sign-in and the Drive mirror
web/src/               React app: sign-in, cabinet, readiness, Tams' chat, settings
web/src/office/        The office view, person cards and the "How everything works" chart
web/src/processes/     Process library: flow, checklist, playback and the editor
web/src/avatars/       The chibi people and Tams, drawn as SVG
web/tests/             Tests for flow layout, playback, the editor rules and desk placement
web/src/styles/tokens.css   Colour, type and spacing tokens shared by every module
data/sample-office/    The invented office that ships with the repo
data/office/           Your working copy, created on first run, never committed
scripts/               Setup script and the sample office generator
docs/data-contract.md  The API shapes other modules build on
```

## Use it for your own office

Deskmate is not tied to the sample office.
An office is a folder: `people.json`, `courses.json`, `processes.json`, `documents.json` and a `documents/` tree.
Copy `data/sample-office` to a new folder, replace its contents with your own, and point Deskmate at it:

```bash
DESKMATE_OFFICE_DIR=/path/to/your-office npm run seed
DESKMATE_OFFICE_DIR=/path/to/your-office npm run dev
```

Keep real office documents out of this repository.
`data/office/` and the database are ignored by git for that reason.

## Design

The method is "work on paper, show on stage".
Work screens - the cabinet, readiness and settings - sit on warm paper with ink type.
Screens that show something - sign-in, Tams, the office and the process library - sit on one deep stage colour.
One accent colour is shared by both.
The tokens are in `web/src/styles/tokens.css`.

## What is not in this build yet

- Google sign-in and the Google Drive mirror are being built as a separate module.
  The sign-in button and the `/auth/google` route are in place and report that Google is not switched on.

## Licence

MIT. See `LICENSE`.
