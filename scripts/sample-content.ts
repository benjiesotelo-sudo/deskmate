// Invented content for the "Deskmate Demo Office".
// Nothing here comes from a real office, course, or person.

export const TERM = "1st Semester 2026-2027";

export type Avatar = { skin: string; hair: string; outfit: string; accessory: string };

export type PersonSeed = {
  id: string;
  username: string;
  name: string;
  role: string;
  access: "admin" | "staff";
  email: string;
  location: "office" | "home";
  desk: { x: number; y: number };
  avatar: Avatar;
};

export const people: PersonSeed[] = [
  {
    id: "marisol",
    username: "marisol",
    name: "Marisol Dantes",
    role: "Office Administrator",
    access: "admin",
    email: "marisol@deskmate.example",
    location: "office",
    desk: { x: 2, y: 2 },
    avatar: { skin: "#C68E6A", hair: "#2B1D16", outfit: "#FF5A3C", accessory: "lanyard" },
  },
  {
    id: "celso",
    username: "celso",
    name: "Celso Marquez",
    role: "Department Chair",
    access: "admin",
    email: "celso@deskmate.example",
    location: "office",
    desk: { x: 9, y: 1 },
    avatar: { skin: "#A9714B", hair: "#8A8A8A", outfit: "#1B1F4B", accessory: "glasses" },
  },
  {
    id: "rafael",
    username: "rafael",
    name: "Rafael Ignacio",
    role: "Course Coordinator - BUS101",
    access: "staff",
    email: "rafael@deskmate.example",
    location: "office",
    desk: { x: 5, y: 2 },
    avatar: { skin: "#B98058", hair: "#1E1E1E", outfit: "#2E7D5B", accessory: "mug" },
  },
  {
    id: "lourdes",
    username: "lourdes",
    name: "Lourdes Abad",
    role: "Course Coordinator - FIN201",
    access: "staff",
    email: "lourdes@deskmate.example",
    location: "home",
    desk: { x: 5, y: 5 },
    avatar: { skin: "#D7A47E", hair: "#3A2418", outfit: "#6C4AB6", accessory: "headset" },
  },
  {
    id: "jomar",
    username: "jomar",
    name: "Jomar Velez",
    role: "Course Coordinator - MKT150",
    access: "staff",
    email: "jomar@deskmate.example",
    location: "office",
    desk: { x: 8, y: 5 },
    avatar: { skin: "#A9714B", hair: "#15120F", outfit: "#D99A1B", accessory: "none" },
  },
  {
    id: "bea",
    username: "bea",
    name: "Bea Soliman",
    role: "Program Assistant (new hire)",
    access: "staff",
    email: "bea@deskmate.example",
    location: "office",
    desk: { x: 2, y: 5 },
    avatar: { skin: "#E0B08C", hair: "#4A2C1A", outfit: "#2F80C2", accessory: "notebook" },
  },
];

export type ChapterSeed = {
  number: number;
  title: string;
  summary: string;
  points: [string, string][];
  terms: [string, string][];
  example: string;
  quiz: [string, string][];
};

export type CourseSeed = {
  id: string;
  title: string;
  coordinator: string;
  description: string;
  outcomes: string[];
  grading: [string, string][];
  book: { title: string; author: string; edition: string; publisher: string; note: string };
  chapters: ChapterSeed[];
};

export const courses: CourseSeed[] = [
  {
    id: "BUS101",
    title: "Foundations of Business",
    coordinator: "rafael",
    description:
      "An introductory course on how a business creates value, how it is owned and organised, how it reports its results, and what it owes the people around it.",
    outcomes: [
      "Explain how a business turns inputs into value for customers.",
      "Compare sole proprietorships, partnerships, corporations and cooperatives.",
      "Read a simple income statement and compute gross and net profit.",
      "Apply a stakeholder view to an everyday business decision.",
    ],
    grading: [
      ["Chapter quizzes (4)", "40%"],
      ["Midterm case paper", "25%"],
      ["Final examination", "25%"],
      ["Class participation", "10%"],
    ],
    book: {
      title: "Business From the Ground Up",
      author: "Deskmate Demo Press Editorial Team",
      edition: "3rd sample edition, 2025",
      publisher: "Deskmate Demo Press",
      note: "Invented title used only for the demo office. Two desk copies are kept in the office cabinet, shelf B.",
    },
    chapters: [
      {
        number: 1,
        title: "What a Business Does",
        summary:
          "A business exists to create value: it buys or makes something, adds work to it, and offers it to customers who think it is worth more than its price.",
        points: [
          ["Value creation", "A business combines inputs such as materials, labour and time into something a customer prefers over keeping their money."],
          ["Revenue, cost and profit", "Revenue is what customers pay. Cost is what the business gives up to serve them. Profit is what remains, and it is the signal that value was created."],
          ["The four functions", "Every business, however small, performs operations, marketing, finance and people management, even when one owner does all four."],
          ["Goods versus services", "Goods can be stored and counted. Services are produced and consumed at the same moment, so capacity and timing matter more than inventory."],
        ],
        terms: [
          ["Value", "The benefit a customer receives compared with the price paid."],
          ["Profit", "Revenue minus all costs for a period."],
          ["Stakeholder", "Anyone affected by what the business does, including customers, staff, owners, suppliers and neighbours."],
        ],
        example:
          "A campus print shop pays 1.20 pesos for paper and ink per page and charges 3.00 pesos. The 1.80 peso difference pays the rent, the attendant and the owner. If students would rather walk to a cheaper shop, the value was not there.",
        quiz: [
          ["What is profit?", "Revenue minus all costs for the period."],
          ["Name the four functions every business performs.", "Operations, marketing, finance and people management."],
          ["Why does timing matter more for a service than for a good?", "A service is produced and consumed at the same moment and cannot be stored."],
          ["A print shop spends 1.20 per page and charges 3.00. What is the margin per page?", "1.80 pesos per page."],
        ],
      },
      {
        number: 2,
        title: "Forms of Ownership",
        summary:
          "How a business is owned decides who controls it, who is liable for its debts, and how easily it can raise money.",
        points: [
          ["Sole proprietorship", "One owner, simple to start, full control, and unlimited personal liability for the debts of the business."],
          ["Partnership", "Two or more owners share work, money and risk under an agreement. Each general partner can bind the others."],
          ["Corporation", "A separate legal person owned through shares. Owners risk only what they invested, but the rules and reporting are heavier."],
          ["Cooperative", "Owned by its members, who are also its customers or workers. One member, one vote, whatever the size of the share."],
        ],
        terms: [
          ["Limited liability", "Owners can lose only the amount they invested, not their personal property."],
          ["Share", "A unit of ownership in a corporation."],
          ["Articles of partnership", "The written agreement that sets out contributions, duties and profit sharing between partners."],
        ],
        example:
          "Two friends open a milk tea stall as partners. When a supplier goes unpaid, the supplier may collect from either friend personally. Had they registered a corporation, only the money already in the stall would be at risk.",
        quiz: [
          ["Which form of ownership has unlimited personal liability with a single owner?", "The sole proprietorship."],
          ["What does limited liability protect?", "The personal property of the owners beyond what they invested."],
          ["How are votes counted in a cooperative?", "One member, one vote."],
          ["Give one disadvantage of a corporation.", "Heavier rules, registration and reporting requirements."],
        ],
      },
      {
        number: 3,
        title: "Reading a Simple Income Statement",
        summary:
          "The income statement tells the story of one period: what was sold, what it cost to sell it, what it cost to run the place, and what was left.",
        points: [
          ["Top line to bottom line", "Start with sales, subtract cost of goods sold to reach gross profit, subtract operating expenses to reach operating profit, then subtract interest and tax to reach net income."],
          ["Gross margin", "Gross profit divided by sales shows how much of each peso of sales is left after the product itself is paid for."],
          ["Operating expenses", "Rent, salaries, utilities and marketing keep the business open whether or not a sale is made today."],
          ["Period matters", "An income statement always covers a span of time. Compare the same span, such as month to month, before judging a trend."],
        ],
        terms: [
          ["Cost of goods sold", "The direct cost of the items actually sold in the period."],
          ["Gross profit", "Sales minus cost of goods sold."],
          ["Net income", "What remains after every expense, interest and tax."],
        ],
        example:
          "A bookstore sells 200,000 pesos in a month. The books cost 120,000, so gross profit is 80,000 and gross margin is 40 percent. Rent and wages take 55,000, leaving 25,000 of operating profit before interest and tax.",
        quiz: [
          ["Sales are 200,000 and cost of goods sold is 120,000. What is gross profit?", "80,000."],
          ["What is the gross margin in that case?", "40 percent."],
          ["Name two operating expenses.", "Any two of rent, salaries, utilities, marketing."],
          ["Why must two income statements cover the same length of time before they are compared?", "Because the statement reports a period, and different spans are not comparable."],
        ],
      },
      {
        number: 4,
        title: "Ethics and Social Responsibility",
        summary:
          "A business keeps its licence to operate by treating the people it touches fairly, not only by obeying the law.",
        points: [
          ["Law is the floor", "Legal compliance is the minimum. Ethics covers the choices the law leaves open."],
          ["Stakeholder view", "List who is affected by a decision before making it: customers, employees, suppliers, the community and the owners."],
          ["Conflicts of interest", "When a personal gain could bend a business judgement, disclose it and step back from the decision."],
          ["Responsibility as strategy", "Fair pay, honest labels and clean operations cost money now and build trust that is hard for rivals to copy."],
        ],
        terms: [
          ["Ethics", "Principles for choosing what is right when rules alone do not decide."],
          ["Conflict of interest", "A situation where personal benefit competes with duty."],
          ["Corporate social responsibility", "The duty of a business to account for its effect on society and the environment."],
        ],
        example:
          "A canteen manager is offered a personal discount by a supplier bidding for the rice contract. The ethical path is to report the offer, decline it, and let someone else score the bids.",
        quiz: [
          ["Why is the law described as the floor and not the ceiling?", "Because legal compliance is the minimum and ethics covers what the law leaves open."],
          ["What should a manager do when facing a conflict of interest?", "Disclose it and step back from the decision."],
          ["Name three stakeholders of a neighbourhood bakery.", "Any three of customers, employees, suppliers, neighbours, owners."],
          ["How can responsible behaviour be a strategy?", "It builds trust that competitors find hard to copy."],
        ],
      },
    ],
  },
  {
    id: "FIN201",
    title: "Personal Finance Basics",
    coordinator: "lourdes",
    description:
      "A practical course on managing money as an individual: planning cash, saving with a purpose, borrowing with care, and taking a first step into investing.",
    outcomes: [
      "Prepare a monthly budget from real income and expenses.",
      "Compute future value and present value for a single sum.",
      "Compare loan offers using the effective annual rate.",
      "Match simple investment choices to a goal and a time horizon.",
    ],
    grading: [
      ["Chapter quizzes (4)", "40%"],
      ["Personal budget project", "20%"],
      ["Midterm examination", "20%"],
      ["Final examination", "20%"],
    ],
    book: {
      title: "Money You Can Explain",
      author: "Deskmate Demo Press Editorial Team",
      edition: "2nd sample edition, 2026",
      publisher: "Deskmate Demo Press",
      note: "Invented title used only for the demo office. The e-book licence sheet is kept with the course coordinator.",
    },
    chapters: [
      {
        number: 1,
        title: "Budgeting and Cash Flow",
        summary:
          "A budget is a plan for where each peso will go before the month begins, checked against where it actually went.",
        points: [
          ["Income first", "List take-home pay and any allowance on the dates they arrive, not the amounts you hope for."],
          ["Fixed and variable spending", "Fixed costs such as rent repeat every month. Variable costs such as food and transport can be steered."],
          ["The 50-30-20 guide", "As a starting point, give about half to needs, about a third to wants, and at least a fifth to savings and debt payments."],
          ["Review weekly", "Compare plan and actual every week. A budget that is only checked at month end is a history lesson, not a plan."],
        ],
        terms: [
          ["Cash flow", "Money coming in minus money going out over a period."],
          ["Fixed expense", "A cost that stays the same from month to month."],
          ["Emergency fund", "Savings set aside for surprises, usually three to six months of needs."],
        ],
        example:
          "A new employee takes home 24,000 pesos a month. Using the 50-30-20 guide, needs get 12,000, wants get 7,200 and savings get 4,800. Rent of 7,000 and transport of 2,500 already use 9,500 of the needs budget.",
        quiz: [
          ["On a take-home pay of 24,000, how much goes to savings under the 50-30-20 guide?", "4,800 pesos."],
          ["Give one example of a fixed expense.", "Rent, a loan instalment or a subscription."],
          ["What is an emergency fund for?", "Unplanned expenses, usually sized at three to six months of needs."],
          ["Why review a budget weekly?", "So that spending can still be corrected before the month ends."],
        ],
      },
      {
        number: 2,
        title: "Saving and the Time Value of Money",
        summary:
          "A peso today is worth more than a peso next year because today's peso can earn interest in between.",
        points: [
          ["Compounding", "Interest earned is added to the balance and then earns interest itself. Growth speeds up the longer money is left alone."],
          ["Future value", "Future value equals present value times one plus the rate, raised to the number of periods."],
          ["Present value", "To find what a future amount is worth today, divide it by one plus the rate, raised to the number of periods."],
          ["The rule of 72", "Divide 72 by the yearly interest rate to estimate how many years it takes money to double."],
        ],
        terms: [
          ["Principal", "The original amount saved or borrowed."],
          ["Compound interest", "Interest computed on both the principal and the interest already earned."],
          ["Discounting", "Converting a future amount into its value today."],
        ],
        example:
          "10,000 pesos saved at 6 percent a year grows to 10,600 after one year and 11,236 after two years. By the rule of 72, it doubles in about 12 years.",
        quiz: [
          ["What is 10,000 at 6 percent a year worth after two years?", "11,236 pesos."],
          ["Using the rule of 72, how long does money take to double at 8 percent?", "About 9 years."],
          ["What is discounting?", "Converting a future amount into its value today."],
          ["Why does compounding speed up over time?", "Because interest is earned on past interest as well as on the principal."],
        ],
      },
      {
        number: 3,
        title: "Credit and Borrowing",
        summary:
          "Borrowing moves future income into the present at a price, and that price is only visible when offers are compared on the same basis.",
        points: [
          ["Good and bad reasons to borrow", "Borrowing for something that lasts longer than the loan can make sense. Borrowing for something already consumed rarely does."],
          ["Effective annual rate", "Convert every offer to its yearly rate including fees. A low monthly rate can hide a high yearly cost."],
          ["Minimum payments", "Paying only the minimum on a card keeps the account in good standing and keeps most of the balance earning interest."],
          ["Credit standing", "Paying on time builds a record that lowers the cost of future loans."],
        ],
        terms: [
          ["Interest rate", "The price of borrowing, stated as a percentage per period."],
          ["Effective annual rate", "The true yearly cost of a loan after compounding and fees."],
          ["Collateral", "An asset pledged to the lender in case the loan is not repaid."],
        ],
        example:
          "A lender advertises 2 percent a month. Compounded, that is about 26.8 percent a year, far above the 24 percent a quick multiplication suggests.",
        quiz: [
          ["A loan charges 2 percent a month. What is the effective annual rate, roughly?", "About 26.8 percent."],
          ["What is collateral?", "An asset pledged to the lender in case of non-payment."],
          ["Why is paying only the minimum on a credit card costly?", "Most of the balance keeps earning interest."],
          ["Give one sensible reason to borrow.", "To buy something that lasts longer than the loan, such as education or equipment."],
        ],
      },
      {
        number: 4,
        title: "Starting to Invest",
        summary:
          "Investing means accepting uncertainty in exchange for the chance of growth, so the first decisions are about goals and time, not products.",
        points: [
          ["Goal and horizon", "Money needed within a year belongs in savings. Money not needed for five years or more can take on market risk."],
          ["Risk and return", "Higher expected returns come with wider swings. Nobody is paid extra for taking no risk."],
          ["Diversification", "Spreading money across many holdings reduces the damage any single one can do."],
          ["Costs compound too", "A fee of 2 percent a year removes a large share of long-run growth. Compare fees before comparing past returns."],
        ],
        terms: [
          ["Diversification", "Holding many different investments to reduce risk."],
          ["Time horizon", "How long the money can stay invested before it is needed."],
          ["Mutual fund", "A pooled investment managed on behalf of many investors."],
        ],
        example:
          "Two funds both earn 8 percent before fees. One charges 0.5 percent and the other 2 percent. Over 20 years, 100,000 pesos grows to about 425,000 in the first and about 321,000 in the second.",
        quiz: [
          ["Where should money needed within a year be kept?", "In savings, not in market investments."],
          ["What does diversification reduce?", "The damage any single investment can do to the whole."],
          ["Why do fees matter so much over long periods?", "They compound, removing a growing share of returns."],
          ["What two questions come before choosing a product?", "What the goal is and how long the money can stay invested."],
        ],
      },
    ],
  },
  {
    id: "MKT150",
    title: "Principles of Marketing",
    coordinator: "jomar",
    description:
      "An introduction to finding out what customers need, designing an offer around it, and reaching them through the right channels.",
    outcomes: [
      "Describe a target customer using needs, not demographics alone.",
      "Design a basic marketing mix for a small product.",
      "Choose digital channels that fit a customer and a budget.",
    ],
    grading: [
      ["Chapter quizzes (3)", "30%"],
      ["Group marketing plan", "40%"],
      ["Final examination", "30%"],
    ],
    book: {
      title: "Marketing Close to the Customer",
      author: "Deskmate Demo Press Editorial Team",
      edition: "1st sample edition, 2026",
      publisher: "Deskmate Demo Press",
      note: "Invented title used only for the demo office. Chapter 3 is being revised for the new digital unit.",
    },
    chapters: [
      {
        number: 1,
        title: "Understanding Customers",
        summary:
          "Marketing begins with a specific person who has a specific problem, not with the product on the shelf.",
        points: [
          ["Needs, wants and demand", "A need is the underlying problem, a want is a preferred way to solve it, and demand is a want backed by the ability to pay."],
          ["Segmentation", "Divide a market into groups that behave alike, then decide which groups the business can serve best."],
          ["The customer journey", "People move from noticing a problem, to comparing options, to buying, to deciding whether to return."],
          ["Listening", "Short interviews with ten real customers usually teach more than a long survey sent to a thousand strangers."],
        ],
        terms: [
          ["Target market", "The group of customers a business chooses to serve."],
          ["Segment", "A group of customers with similar needs or behaviour."],
          ["Value proposition", "The short reason a customer should choose this offer over another."],
        ],
        example:
          "A laundry shop near dormitories learns from interviews that students care most about same-day pickup. It stops advertising low prices and promises clothes back by 6 pm.",
        quiz: [
          ["What is the difference between a need and a want?", "A need is the underlying problem and a want is a preferred way to solve it."],
          ["What is a segment?", "A group of customers with similar needs or behaviour."],
          ["Name the stages of the customer journey.", "Noticing a problem, comparing options, buying, and deciding whether to return."],
          ["Why interview a few real customers?", "They reveal what actually matters, which large surveys often miss."],
        ],
      },
      {
        number: 2,
        title: "The Marketing Mix",
        summary:
          "Product, price, place and promotion are four levers that must tell the same story to the same customer.",
        points: [
          ["Product", "What is offered, including quality, packaging and after-sales service."],
          ["Price", "What the customer gives up. Price signals quality as well as covering cost."],
          ["Place", "Where and how the customer gets the product, from a physical counter to a delivery app."],
          ["Promotion", "How the customer hears about the offer and is reminded of it."],
        ],
        terms: [
          ["Marketing mix", "The combination of product, price, place and promotion."],
          ["Positioning", "The place an offer holds in the mind of the customer compared with rivals."],
          ["Distribution channel", "The path a product takes from maker to customer."],
        ],
        example:
          "A premium coffee cart that prices at 180 pesos, sells from a tidy kiosk in an office lobby and posts quiet photos of its beans is consistent. The same cart shouting discount codes would confuse its own customers.",
        quiz: [
          ["List the four elements of the marketing mix.", "Product, price, place and promotion."],
          ["What does price communicate besides cost?", "A signal of quality."],
          ["What is positioning?", "The place an offer holds in the customer's mind relative to rivals."],
          ["Why must the four elements be consistent?", "Mixed signals confuse the target customer."],
        ],
      },
      {
        number: 3,
        title: "Digital Channels",
        summary:
          "Digital channels are places where customers already spend attention, and each one rewards a different kind of message.",
        points: [
          ["Owned, earned and paid", "Owned channels are yours, such as a page or mailing list. Earned attention comes from others sharing. Paid attention is rented."],
          ["Search and social", "Search catches people who already know what they want. Social reaches people before they are looking."],
          ["Measure what matters", "Track the step that leads to a sale, such as a message sent or a cart started, not only likes."],
          ["Small tests", "Run two versions of a post with a small budget and keep the better one before spending more."],
        ],
        terms: [
          ["Conversion", "A visitor taking the action the business wanted."],
          ["Reach", "The number of different people who saw a message."],
          ["Call to action", "The next step a message asks the reader to take."],
        ],
        example:
          "A home baker posts the same cake with two captions and 200 pesos of promotion each. The caption that says 'Order by Thursday for Saturday pickup' brings 14 messages against 3, so the rest of the budget goes there.",
        quiz: [
          ["What is the difference between owned and paid channels?", "Owned channels belong to the business and paid channels are rented attention."],
          ["What is a conversion?", "A visitor taking the action the business wanted."],
          ["Why test two versions on a small budget first?", "To learn which performs better before spending more."],
          ["Which channel reaches people who already know what they want?", "Search."],
        ],
      },
    ],
  },
];

// What exists in the cabinet for each required slot.
// Anything not listed here is filed once, as version 1, with status "current".
// "missing" leaves the slot empty so the readiness screen has real gaps to name.
export type SlotOverride =
  | { state: "missing" }
  | { state: "draft" }
  | { state: "superseded-only" }
  | { state: "revised" }; // v1 superseded + v2 current

export const slotOverrides: Record<string, SlotOverride> = {
  "BUS101:syllabus": { state: "revised" },
  "BUS101:1:deck": { state: "revised" },
  "BUS101:4:quiz": { state: "missing" },
  "FIN201:2:deck": { state: "draft" },
  "FIN201:4:materials": { state: "superseded-only" },
  "FIN201:4:quiz": { state: "missing" },
  "MKT150:syllabus": { state: "draft" },
  "MKT150:3:deck": { state: "missing" },
  "MKT150:3:materials": { state: "draft" },
  "MKT150:3:quiz": { state: "missing" },
};

// Which slots are filed as a PDF or a Word file instead of markdown.
export const slotFormats: Record<string, "pdf" | "docx"> = {
  "BUS101:syllabus": "pdf",
  "FIN201:syllabus": "pdf",
  "FIN201:1:materials": "docx",
  "BUS101:3:materials": "pdf",
};
