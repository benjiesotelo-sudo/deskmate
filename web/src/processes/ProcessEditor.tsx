import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "../lib/session";
import { discardLocalEdits, personById, saveProcess, type OfficeData } from "./api";
import { finaliseIds, NEW_PREFIX, problemsOf } from "./edit";
import { PlusIcon, TrashIcon } from "./icons";
import { ProcessFlow } from "./ProcessFlow";
import { KIND_LABEL, STEP_KINDS, type OfficeProcess, type ProcessStep, type StepKind } from "./types";

// A plain editor for the steps of one process: add, edit, link, delete, save.
// It saves the whole process through PUT /api/processes/:id (see saveProcess).
// The process owner and office admins can save; everyone else can read and try changes.

type Status = { tone: "ok" | "local" | "error"; text: string } | null;

export function ProcessEditor({ process, data }: { process: OfficeProcess; data: OfficeData }) {
  const [draft, setDraft] = useState<OfficeProcess>(() => structuredClone(process));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [counter, setCounter] = useState(1);
  const resetOnLoad = useRef(false);

  // After browser-only edits are discarded the shipped process comes back: show that one.
  useEffect(() => {
    if (!resetOnLoad.current) return;
    resetOnLoad.current = false;
    setDraft(structuredClone(process));
  }, [process]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(process), [draft, process]);
  const { errors, warnings } = useMemo(() => problemsOf(draft), [draft]);
  const documents = useMemo(
    () => Object.entries(data.documentTitles).sort((a, b) => a[1].localeCompare(b[1])),
    [data.documentTitles],
  );
  const isLocal = data.localEdits.includes(process.id);
  // The server enforces the same rule: an office admin or the process owner.
  const { me } = useSession();
  const canSave = me?.access === "admin" || me?.id === process.owner;

  const update = (stepId: string, change: Partial<ProcessStep>) => {
    setStatus(null);
    setDraft((current) => ({
      ...current,
      steps: current.steps.map((step) => {
        if (step.id !== stepId) return step;
        const next = { ...step, ...change };
        if (next.kind === "end") next.next = [];
        if (!next.artifact) delete next.artifact;
        return next;
      }),
    }));
  };

  const toggleNext = (stepId: string, targetId: string) => {
    const step = draft.steps.find((item) => item.id === stepId);
    if (!step) return;
    const has = step.next.includes(targetId);
    update(stepId, { next: has ? step.next.filter((id) => id !== targetId) : [...step.next, targetId] });
  };

  // Add a step. After an existing step it is spliced into the flow: A -> new -> whatever A led to.
  const addStep = (afterId?: string) => {
    const id = `${NEW_PREFIX}${counter}`;
    setCounter((value) => value + 1);
    setStatus(null);
    setFocusId(id);
    setDraft((current) => {
      const after = current.steps.find((step) => step.id === afterId);
      const fresh: ProcessStep = {
        id,
        title: "",
        kind: current.steps.length === 0 ? "start" : "task",
        actor: after?.actor ?? current.owner ?? data.people[0]?.id ?? "",
        description: "",
        example: "",
        next: after && after.kind !== "end" ? [...after.next] : [],
      };
      if (!after) return { ...current, steps: [...current.steps, fresh] };
      const steps: ProcessStep[] = [];
      for (const step of current.steps) {
        if (step.id === after.id) {
          steps.push(after.kind === "end" ? { ...step, kind: "task", next: [id] } : { ...step, next: [id] });
          steps.push(after.kind === "end" ? { ...fresh, kind: "end" } : fresh);
        } else steps.push(step);
      }
      return { ...current, steps };
    });
  };

  // Delete a step and close the gap: whoever pointed at it now points at what it led to.
  const removeStep = (stepId: string) => {
    setStatus(null);
    setDraft((current) => {
      const gone = current.steps.find((step) => step.id === stepId);
      if (!gone) return current;
      return {
        ...current,
        steps: current.steps
          .filter((step) => step.id !== stepId)
          .map((step) => {
            if (!step.next.includes(stepId)) return step;
            const bridged = step.next.flatMap((id) => (id === stepId ? gone.next.filter((n) => n !== step.id) : [id]));
            return { ...step, next: Array.from(new Set(bridged)) };
          }),
      };
    });
  };

  const save = async () => {
    if (errors.length > 0 || !canSave) return;
    setSaving(true);
    setStatus(null);
    try {
      const final = finaliseIds(draft);
      const result = await saveProcess(final);
      setDraft(structuredClone(final));
      setStatus(
        result.where === "server"
          ? { tone: "ok", text: "Saved. Everyone in the office now sees this version, and Tams answers from it." }
          : { tone: "local", text: "Saved in this browser only. Deskmate is not answering, so nobody else sees this change yet. Save again once it is back." },
      );
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "The save did not go through." });
    } finally {
      setSaving(false);
    }
  };

  const discard = async () => {
    setSaving(true);
    try {
      resetOnLoad.current = true;
      await discardLocalEdits(process.id);
      setStatus(null);
    } finally {
      setSaving(false);
    }
  };

  const titleOf = (step: ProcessStep) => step.title.trim() || "Untitled step";

  return (
    <div className="editor">
      <div className="dm-stage editor-preview">
        <ProcessFlow process={draft} people={data.people} selectedId={focusId} onSelect={setFocusId} />
      </div>

      <div className="editor-bar">
        <div className="editor-bar-text">
          <strong>{!canSave ? "You can try changes here, but not save them" : dirty ? "Unsaved changes" : "Nothing to save"}</strong>
          <span className="dm-muted">The picture above redraws as you edit. Play follows the first link of a step that has not been walked yet.</span>
        </div>
        <div className="editor-bar-actions">
          {isLocal ? (
            <button type="button" className="dm-button" onClick={discard} disabled={saving}>
              Discard browser-only edits
            </button>
          ) : null}
          <button type="button" className="dm-button" onClick={() => setDraft(structuredClone(process))} disabled={!dirty || saving}>
            Undo changes
          </button>
          <button type="button" className="dm-button dm-button-accent" onClick={save} disabled={!canSave || !dirty || saving || errors.length > 0}>
            {saving ? "Saving..." : "Save process"}
          </button>
        </div>
      </div>

      {!canSave ? (
        <p className="dm-note" role="note">
          Only {personById(data.people, process.owner)?.name ?? "the process owner"} or an office admin can save changes to this process.
        </p>
      ) : null}
      {status ? (
        <p className={`dm-note${status.tone === "error" ? " dm-note-error" : status.tone === "local" ? " dm-note-warn" : " dm-note-ok"}`} role="status">
          {status.text}
        </p>
      ) : null}
      {errors.length > 0 ? (
        <ul className="dm-note dm-note-error editor-problems" role="alert">
          {errors.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      ) : null}
      {warnings.length > 0 ? (
        <ul className="dm-note dm-note-warn editor-problems">
          {warnings.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      ) : null}

      <ol className="editor-steps">
        {draft.steps.map((step, index) => (
          <li key={step.id} className={`dm-card editor-step${focusId === step.id ? " is-focus" : ""}`} onFocus={() => setFocusId(step.id)}>
            <div className="editor-step-head">
              <span className="editor-number">{index + 1}</span>
              <label className="field field-grow">
                <span>Title</span>
                <input
                  type="text"
                  value={step.title}
                  placeholder="What happens in this step?"
                  autoFocus={step.id === focusId && step.id.startsWith(NEW_PREFIX) && step.title === ""}
                  onChange={(event) => update(step.id, { title: event.target.value })}
                />
              </label>
              <label className="field">
                <span>Kind</span>
                <select value={step.kind} onChange={(event) => update(step.id, { kind: event.target.value as StepKind })}>
                  {STEP_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {KIND_LABEL[kind]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Who does it</span>
                <select value={step.actor} onChange={(event) => update(step.id, { actor: event.target.value })}>
                  {data.people.some((person) => person.id === step.actor) ? null : <option value={step.actor}>{step.actor || "Choose someone"}</option>}
                  {data.people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="editor-step-body">
              <label className="field">
                <span>Description</span>
                <textarea rows={3} value={step.description} placeholder="How to do it, in a sentence or two." onChange={(event) => update(step.id, { description: event.target.value })} />
              </label>
              <label className="field">
                <span>Real example</span>
                <textarea rows={3} value={step.example} placeholder="One time this actually happened, with names and dates." onChange={(event) => update(step.id, { example: event.target.value })} />
              </label>
            </div>

            <div className="editor-step-links">
              {step.kind === "end" ? (
                <p className="dm-muted">An end step leads nowhere.</p>
              ) : (
                <fieldset className="field">
                  <legend>Leads to</legend>
                  <div className="link-options">
                    {draft.steps
                      .filter((other) => other.id !== step.id)
                      .map((other) => {
                        const position = step.next.indexOf(other.id);
                        return (
                          <label key={other.id} className={`link-option${position >= 0 ? " is-on" : ""}`}>
                            <input type="checkbox" checked={position >= 0} onChange={() => toggleNext(step.id, other.id)} />
                            {titleOf(other)}
                            {position >= 0 && step.next.length > 1 ? <span className="link-order">{position + 1}</span> : null}
                          </label>
                        );
                      })}
                  </div>
                </fieldset>
              )}
              {documents.length > 0 ? (
                <label className="field">
                  <span>Document for this step</span>
                  <select value={step.artifact ?? ""} onChange={(event) => update(step.id, { artifact: event.target.value || undefined })}>
                    <option value="">None</option>
                    {step.artifact && !data.documentTitles[step.artifact] ? <option value={step.artifact}>{step.artifact}</option> : null}
                    {documents.map(([id, title]) => (
                      <option key={id} value={id}>
                        {title} ({id})
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            <div className="editor-step-actions">
              <button type="button" className="dm-button dm-button-small" onClick={() => addStep(step.id)}>
                <PlusIcon size={14} /> Add a step after this
              </button>
              <button type="button" className="dm-button dm-button-small dm-button-danger" onClick={() => removeStep(step.id)}>
                <TrashIcon size={14} /> Delete step
              </button>
            </div>
          </li>
        ))}
      </ol>

      <button type="button" className="dm-button editor-add" onClick={() => addStep()}>
        <PlusIcon size={16} /> Add a step
      </button>
    </div>
  );
}
