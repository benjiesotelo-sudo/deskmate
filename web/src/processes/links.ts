// Every URL this module links to, in one place.
// The first four are owned here. The last two belong to deskmate-core (Tams' chat and the
// filing cabinet): if core mounts them elsewhere, change them here and nowhere else.

export const links = {
  office: () => "/office",
  officePlay: (processId: string) => `/office?play=${encodeURIComponent(processId)}`,
  processes: () => "/processes",
  process: (processId: string) => `/processes/${encodeURIComponent(processId)}`,
  tams: (question: string) => `/tams?q=${encodeURIComponent(question)}`,
  document: (docId: string) => `/cabinet?doc=${encodeURIComponent(docId)}`,
};
