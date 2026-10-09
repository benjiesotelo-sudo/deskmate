// Every URL this module links to, in one place.
// The first four are owned here. The last two belong to deskmate-core (Tams' chat at /tams and
// a document's page at /documents/:id): if core moves them, change them here and nowhere else.

export const links = {
  office: () => "/office",
  officePlay: (processId: string) => `/office?play=${encodeURIComponent(processId)}`,
  processes: () => "/processes",
  process: (processId: string) => `/processes/${encodeURIComponent(processId)}`,
  tams: (question: string) => `/tams?q=${encodeURIComponent(question)}`,
  document: (docId: string) => `/documents/${encodeURIComponent(docId)}`,
};
