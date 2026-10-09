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
- **One link for everyone.** The account decides what opens.
  An admin sees and edits the whole office.
  A staff account opens on what it owns, can read the rest, and can edit only its own records.

## Why this runs on local AI

- **Confidential documents never leave the machine.** Quizzes, answer keys and staff records are exactly what an office should not paste into a cloud chatbot.
  In local mode nothing is sent anywhere.
- **It works when the wifi dies.** Sign-in, the cabinet, readiness and Tams all run on this computer.
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

- Built and tested on a Mac mini with Apple M4 and 16 GB of memory, macOS 26.5, Node 26.6, Ollama 0.40.
- Sized for the demo machine, an 8 GB M2 Mac mini.
- With both models loaded Ollama uses about 3.3 GB (2.9 GB for `qwen3:4b`, 0.4 GB for `nomic-embed-text`).
- On the test machine the first word of a grounded answer arrives in about 1 to 4 seconds and a full process answer takes about 4 to 9 seconds.
- There are no native modules to compile, so `npm install` does not need Xcode or Python.

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

### A five minute tour

1. Sign in as `marisol`.
2. Open the filing cabinet and go into FIN201, then a chapter, then a quiz.
3. Open Readiness and read the big number: 78 percent, 28 of 36 required documents.
4. Click "File it" on a missing quiz, read "Where does this go?", and file it.
   Readiness goes up.
5. Open Ask Tams and ask "How do I release a quiz?".
   The answer streams from the local model, names its source, and offers "Show me in the office".
6. Turn the wifi off and ask again.
7. Sign out and sign in as `bea` to see the same screens scoped to a new hire.

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

`qwen3:4b` is a reasoning model that thinks out loud for many seconds before it answers, even when asked not to.
Deskmate sends `think: false` and hands the model an already-finished thought, so the first word arrives in a few seconds instead of twenty.

## Project layout

```
server/src/            Express API, SQLite, sign-in, readiness
server/src/tams/       Tams: chunking, embeddings, retrieval, local and cloud chat
server/src/google.ts   The seam for Google sign-in and the Drive mirror
web/src/               React app
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
Screens that show something - sign-in, Tams and the office view - sit on one deep stage colour.
One accent colour is shared by both.
The tokens are in `web/src/styles/tokens.css`.

## What is not in this build yet

- The animated office view and the process library are being built as a separate module.
  The routes `/office` and `/processes/:id` are reserved and show a placeholder.
- Google sign-in and the Google Drive mirror are being built as a separate module.
  The sign-in button and the `/auth/google` route are in place and report that Google is not switched on.

## Licence

MIT. See `LICENSE`.
