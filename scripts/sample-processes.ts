// The four documented processes of the invented "Deskmate Demo Office".
// Step artifacts point at document ids produced by build-sample-office.ts.

export type StepSeed = {
  id: string;
  title: string;
  kind: "start" | "task" | "decision" | "end";
  actor: string;
  description: string;
  example: string;
  artifact?: string;
  next: string[];
};

export type ProcessSeed = {
  id: string;
  name: string;
  owner: string;
  summary: string;
  trigger: string;
  example: string;
  steps: StepSeed[];
};

export const processes: ProcessSeed[] = [
  {
    id: "file-course-material",
    name: "File new course material",
    owner: "marisol",
    summary:
      "How a new or revised deck, reading or quiz gets into the filing cabinet with the right record, so there is always exactly one current version per chapter.",
    trigger: "A faculty member or coordinator sends a new or revised deck, reading, quiz, syllabus or book record.",
    example:
      "Rafael revised the Chapter 1 deck for BUS101 after the first week of classes. The old deck became version 1, superseded, and the new one was filed as version 2, current.",
    steps: [
      {
        id: "receive",
        title: "Receive the file",
        kind: "start",
        actor: "bea",
        description:
          "The file arrives by email or is handed over on a drive. Save it once to your desk, and do not rename it yet.",
        example: "Rafael emails 'ch1 slides FINAL final.md' on Monday morning.",
        next: ["identify"],
      },
      {
        id: "identify",
        title: "Identify course, chapter and kind",
        kind: "task",
        actor: "bea",
        description:
          "Work out the three facts every record needs: which course, which chapter (or the whole course), and which kind: syllabus, deck, materials, quiz or book. If any is unclear, ask the course coordinator before filing.",
        example: "It is BUS101, Chapter 1, and it is a deck.",
        artifact: "office-filing-guide-v1",
        next: ["check-existing"],
      },
      {
        id: "check-existing",
        title: "Is there already a current version?",
        kind: "decision",
        actor: "bea",
        description:
          "Open the cabinet at that course and chapter. If a document of the same kind is marked current, this is a revision. If not, it is a first filing.",
        example: "BUS101 Chapter 1 already has a current deck, version 1. This is a revision.",
        next: ["supersede", "name-file"],
      },
      {
        id: "supersede",
        title: "Mark the old version superseded",
        kind: "task",
        actor: "bea",
        description:
          "Open the old document's record and change its status from current to superseded. Never delete it: accreditors may ask what was used in an earlier term.",
        example: "BUS101-ch01-deck-v1 is changed to superseded.",
        artifact: "bus101-ch01-deck-v1",
        next: ["name-file"],
      },
      {
        id: "name-file",
        title: "Name the file by the guide",
        kind: "task",
        actor: "bea",
        description:
          "Use the pattern COURSE-chNN-kind-vN. The version is one more than the last filed version, or 1 for a first filing. Deskmate suggests the name and folder on the filing screen under 'Where does this go?'.",
        example: "The new file becomes BUS101-ch01-deck-v2.md in documents/BUS101/chapter-01.",
        artifact: "office-filing-guide-v1",
        next: ["file-it"],
      },
      {
        id: "file-it",
        title: "File it and set the record",
        kind: "task",
        actor: "bea",
        description:
          "On the filing screen choose the course, chapter and kind, attach the file, set the owner to the course coordinator and the status to current. Drafts that are not yet approved are filed as draft instead.",
        example: "Owner: Rafael Ignacio. Status: current. Version: 2.",
        artifact: "bus101-ch01-deck-v2",
        next: ["tell-coordinator"],
      },
      {
        id: "tell-coordinator",
        title: "Tell the coordinator it is filed",
        kind: "task",
        actor: "bea",
        description:
          "Send the coordinator the link to the document page so they can confirm the right version is current.",
        example: "'Hi Rafael, BUS101 Chapter 1 deck v2 is filed and current. v1 is superseded.'",
        next: ["done"],
      },
      {
        id: "done",
        title: "Filed",
        kind: "end",
        actor: "rafael",
        description: "The coordinator confirms. The readiness screen now counts this slot as complete.",
        example: "Rafael replies 'Confirmed' and the BUS101 checklist stays green for Chapter 1.",
        next: [],
      },
    ],
  },
  {
    id: "release-quiz",
    name: "Release a quiz",
    owner: "lourdes",
    summary:
      "How a chapter quiz goes from the filed document to the students on the date the syllabus promises, with its answer key checked first.",
    trigger: "A quiz date in the syllabus is five working days away.",
    example:
      "The FIN201 Chapter 1 quiz on budgeting was due in week 3. Lourdes checked the answer key on Monday, Bea scheduled it on the learning platform for Friday 9:00 am, and students were reminded on Wednesday.",
    steps: [
      {
        id: "start",
        title: "Quiz date is five working days away",
        kind: "start",
        actor: "lourdes",
        description:
          "The course coordinator checks the syllabus schedule every Monday. Any quiz due within five working days starts this process.",
        example: "The FIN201 syllabus lists the Chapter 1 quiz for Friday of week 3.",
        artifact: "fin201-syllabus-v1",
        next: ["find-quiz"],
      },
      {
        id: "find-quiz",
        title: "Open the current quiz in the cabinet",
        kind: "task",
        actor: "bea",
        description:
          "Go to the course and chapter in the cabinet and open the quiz marked current. Never release a draft or a superseded quiz. If no current quiz exists, tell the coordinator the same day.",
        example: "FIN201, Chapter 1, quiz, version 1, current.",
        artifact: "fin201-ch01-quiz-v1",
        next: ["key-check"],
      },
      {
        id: "key-check",
        title: "Has the coordinator checked the answer key?",
        kind: "decision",
        actor: "lourdes",
        description:
          "The coordinator answers every item against the key. A quiz goes out only when the key is confirmed. If an item is wrong or unclear, it goes back to its author.",
        example: "Lourdes works all four items and confirms the key on Monday afternoon.",
        artifact: "office-quiz-release-checklist-v1",
        next: ["return-to-author", "schedule"],
      },
      {
        id: "return-to-author",
        title: "Return it to the author for a fix",
        kind: "task",
        actor: "lourdes",
        description:
          "Send the item number and the problem to the author. The corrected quiz is filed as a new version through the filing process, then this process resumes at the answer key check.",
        example: "'Item 3: the answer should be 4,800, the key says 4,000. Please correct and resend.'",
        next: ["key-check"],
      },
      {
        id: "schedule",
        title: "Schedule the release",
        kind: "task",
        actor: "bea",
        description:
          "On the learning platform, create the quiz from the filed document, set it to open at the class start time on the syllabus date, give it a 20 minute limit and one attempt, and hide the answers until it closes.",
        example: "Opens Friday 9:00 am, closes Friday 9:30 am, 20 minutes, one attempt.",
        artifact: "office-quiz-release-checklist-v1",
        next: ["remind"],
      },
      {
        id: "remind",
        title: "Remind the students two days before",
        kind: "task",
        actor: "bea",
        description:
          "Post an announcement naming the chapter, the date, the time limit and the coverage. Do not attach the quiz.",
        example: "'Quiz 1 covers Chapter 1, Budgeting and Cash Flow. Friday 9:00 am, 20 minutes, one attempt.'",
        next: ["file-results"],
      },
      {
        id: "file-results",
        title: "File the results summary",
        kind: "task",
        actor: "lourdes",
        description:
          "After the quiz closes, the coordinator exports the score summary and files it under the same course and chapter as kind 'other', so the evidence sits beside the quiz itself.",
        example: "Class average 3.1 out of 4. Item 2 was missed most often and will be reviewed next meeting.",
        next: ["done"],
      },
      {
        id: "done",
        title: "Quiz released and recorded",
        kind: "end",
        actor: "lourdes",
        description: "The quiz was taken on the promised date and its evidence is in the cabinet.",
        example: "FIN201 Chapter 1 shows a current quiz and a results summary.",
        next: [],
      },
    ],
  },
  {
    id: "accreditation-check",
    name: "Accreditation document check",
    owner: "celso",
    summary:
      "How the office confirms, course by course, that every required document is present and current before accreditors arrive.",
    trigger: "An accreditation visit is announced, or a new term begins.",
    example:
      "Six weeks before the visit, the readiness screen showed MKT150 at 60 percent. Jomar was asked for the Chapter 3 deck and quiz, and the chair signed off once every course reached 100 percent.",
    steps: [
      {
        id: "start",
        title: "Visit announced or term begins",
        kind: "start",
        actor: "celso",
        description: "The chair asks the office administrator to run the document check and names the deadline.",
        example: "'The visit is in six weeks. I want every course complete in four.'",
        next: ["open-readiness"],
      },
      {
        id: "open-readiness",
        title: "Open the readiness screen",
        kind: "task",
        actor: "marisol",
        description:
          "Readiness lists, for each course, the syllabus and each chapter's deck, materials and quiz. A slot counts only when a document of that kind is filed and marked current.",
        example: "BUS101 is at 12 of 13. FIN201 is at 10 of 13. MKT150 is at 6 of 10.",
        artifact: "office-accreditation-evidence-list-v1",
        next: ["assign-gaps"],
      },
      {
        id: "assign-gaps",
        title: "Send each gap to its owner",
        kind: "task",
        actor: "marisol",
        description:
          "Each gap names the course, chapter and kind. Send it to the course coordinator with the deadline. Drafts need approval, missing documents need to be written or found, and superseded-only slots need a current version.",
        example: "'Jomar: MKT150 Chapter 3 needs a deck and a quiz, and the materials are still a draft. Due in two weeks.'",
        next: ["all-current"],
      },
      {
        id: "all-current",
        title: "Is every required document current?",
        kind: "decision",
        actor: "marisol",
        description:
          "Re-open readiness after the deadline. If any course is below 100 percent, the remaining gaps go back to their owners. If all are complete, move to sign-off.",
        example: "After two weeks, only FIN201 Chapter 4 quiz is still missing.",
        next: ["assign-gaps", "consistency"],
      },
      {
        id: "consistency",
        title: "Check the documents agree with each other",
        kind: "task",
        actor: "marisol",
        description:
          "For each course, confirm that the chapter titles in the syllabus match the decks and quizzes, that the term is the same on every record, and that the book record names the edition the syllabus cites.",
        example: "The BUS101 syllabus lists four chapters and the cabinet holds four chapter folders with matching titles.",
        artifact: "bus101-syllabus-v2",
        next: ["sign-off"],
      },
      {
        id: "sign-off",
        title: "Chair signs off",
        kind: "task",
        actor: "celso",
        description:
          "The chair reviews the readiness screen with the administrator and signs the evidence list. Any exception is written on the list with a date.",
        example: "Celso signs the list on the Friday before the visit with no exceptions.",
        artifact: "office-accreditation-evidence-list-v1",
        next: ["done"],
      },
      {
        id: "done",
        title: "Ready for the visit",
        kind: "end",
        actor: "celso",
        description: "Every course is complete and the signed evidence list is filed.",
        example: "All three courses show 100 percent.",
        next: [],
      },
    ],
  },
  {
    id: "staff-handover",
    name: "Staff turnover handover",
    owner: "marisol",
    summary:
      "How work is passed on when someone leaves or changes role, so the next person inherits documents, processes and context instead of a mystery folder.",
    trigger: "A staff member gives notice, goes on long leave, or is reassigned.",
    example:
      "When the previous program assistant moved to another department, Marisol listed the 9 documents and 1 process she owned, walked Bea through a real quiz release, and reassigned the records on her last day.",
    steps: [
      {
        id: "start",
        title: "Notice is given",
        kind: "start",
        actor: "marisol",
        description: "The administrator opens a handover as soon as the last working day is known, ideally two weeks ahead.",
        example: "The outgoing assistant's last day is the 30th. The handover opens on the 16th.",
        next: ["list-owned"],
      },
      {
        id: "list-owned",
        title: "List everything they own",
        kind: "task",
        actor: "marisol",
        description:
          "Use the directory to list every document and process whose owner is the person leaving. This list is the scope of the handover. Copy it into the handover template.",
        example: "9 documents across FIN201 and MKT150, and the 'File new course material' process steps.",
        artifact: "office-handover-template-v1",
        next: ["name-successor"],
      },
      {
        id: "name-successor",
        title: "Name a successor for each item",
        kind: "task",
        actor: "celso",
        description: "The chair decides who takes each document and process. One person per item, never 'the team'.",
        example: "Bea takes filing. Lourdes keeps the FIN201 documents.",
        next: ["walkthrough"],
      },
      {
        id: "walkthrough",
        title: "Walk through each process with a real example",
        kind: "task",
        actor: "bea",
        description:
          "The successor performs each process once while the outgoing person watches, using a real case and the documented steps in Deskmate. Anything that was not in the steps is added to the process on the spot.",
        example: "Bea files a revised deck herself while the outgoing assistant only answers questions.",
        next: ["drafts"],
      },
      {
        id: "drafts",
        title: "Are any drafts unfinished?",
        kind: "decision",
        actor: "marisol",
        description:
          "Filter the cabinet for the person's documents with status draft. Each one is either finished before the last day or handed over with a written note of what remains.",
        example: "One draft: MKT150 Chapter 3 materials, waiting on two more readings.",
        next: ["note-drafts", "reassign"],
      },
      {
        id: "note-drafts",
        title: "Write what remains on each draft",
        kind: "task",
        actor: "jomar",
        description: "The owner of the draft writes what is missing and who is waiting on it in the handover template.",
        example: "'Needs the two readings on measurement. Jomar will send them by week 5.'",
        artifact: "mkt150-ch03-materials-v1",
        next: ["reassign"],
      },
      {
        id: "reassign",
        title: "Reassign the records",
        kind: "task",
        actor: "marisol",
        description:
          "On each document page, change the owner to the successor. The directory and the readiness screen update on their own.",
        example: "Nine records change owner on the last working day.",
        next: ["week-one"],
      },
      {
        id: "week-one",
        title: "Check in after one week",
        kind: "task",
        actor: "marisol",
        description:
          "A week later, ask the successor what was unclear and fix the process documentation while the questions are fresh.",
        example: "Bea asks where results summaries go. The quiz release process gains a step.",
        next: ["done"],
      },
      {
        id: "done",
        title: "Handover complete",
        kind: "end",
        actor: "marisol",
        description: "Every item has one owner who has done the work at least once.",
        example: "The signed handover template is filed under OFFICE.",
        next: [],
      },
    ],
  },
];
