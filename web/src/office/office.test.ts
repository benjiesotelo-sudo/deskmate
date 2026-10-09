import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { resolveLook } from "../avatars/tokens.ts";
import type { Person } from "../processes/types.ts";
import { HOME, placeDesks, placeHome, ROOM, whereabouts } from "./layout.ts";

const people = JSON.parse(readFileSync(fileURLToPath(new URL("../../../data/sample-office/people.json", import.meta.url)), "utf8")) as Person[];

const person = (id: string, x: number, y: number, location: Person["location"] = "office"): Person => ({
  id,
  name: id,
  role: "",
  email: "",
  location,
  desk: { x, y },
  avatar: { skin: "", hair: "", outfit: "", accessory: "" },
  owns: { documents: [], processes: [] },
});

test("every desk in the sample office lands inside the room, clear of the others", () => {
  const desks = placeDesks(people);
  assert.equal(desks.size, people.length);
  const spots = [...desks.values()];
  for (const spot of spots) {
    assert.ok(spot.x > ROOM.x + 80 && spot.x < ROOM.x + ROOM.width - 80);
    assert.ok(spot.y > ROOM.y + 100 && spot.y < ROOM.y + ROOM.height - 240, "above the front desk");
  }
  for (let i = 0; i < spots.length; i += 1) {
    for (let j = i + 1; j < spots.length; j += 1) {
      const a = spots[i] as { x: number; y: number };
      const b = spots[j] as { x: number; y: number };
      assert.ok(Math.abs(a.x - b.x) >= 140 || Math.abs(a.y - b.y) >= 150, "desks do not overlap");
    }
  }
});

test("people working from home are never missing: each gets a slot in the home strip", () => {
  const atHome = people.filter((item) => item.location === "home");
  assert.ok(atHome.length > 0, "the sample has someone at home");
  const slots = placeHome(people);
  const spots = whereabouts(people);
  assert.equal(spots.size, people.length);
  for (const item of atHome) {
    const slot = slots.get(item.id);
    assert.ok(slot && slot.x > HOME.x && slot.x < HOME.x + HOME.width);
    assert.deepEqual(spots.get(item.id), slot);
  }
});

test("desk placement copes with any units, one desk, and a full house at home", () => {
  const wide = placeDesks([person("a", 0, 0), person("b", 4000, 0), person("c", 2000, 900)]);
  for (const spot of wide.values()) assert.ok(spot.x >= 150 && spot.x <= 836 && spot.y >= 164 && spot.y <= 384);
  const single = placeDesks([person("a", 3, 3)]).get("a");
  assert.ok(single && Number.isFinite(single.x) && Number.isFinite(single.y));
  const crowd = Array.from({ length: 7 }, (_, index) => person(`h${index}`, index, 0, "home"));
  const slots = [...placeHome(crowd).values()];
  assert.equal(new Set(slots.map((slot) => `${Math.round(slot.x)}:${Math.round(slot.y)}`)).size, 7);
  for (const slot of slots) assert.ok(slot.y < HOME.y + HOME.height - 40);
});

test("avatar tokens always resolve to something drawable", () => {
  const named = resolveLook({ skin: "tan", hair: "bun-black", outfit: "blazer-plum", accessory: "glasses" }, "x");
  assert.deepEqual([named.hairStyle, named.outfitStyle, named.accessory], ["bun", "blazer", "glasses"]);
  const hex = resolveLook({ skin: "#C68E6A", hair: "#2B1D16", outfit: "#FF5A3C", accessory: "lanyard" }, "marisol");
  assert.deepEqual([hex.skin, hex.hairColour, hex.outfitColour], ["#c68e6a", "#2b1d16", "#ff5a3c"]);
  assert.deepEqual(resolveLook({ skin: "#C68E6A", hair: "#2B1D16", outfit: "#FF5A3C", accessory: "lanyard" }, "marisol"), hex, "stable");
  const junk = resolveLook({ skin: "plaid", hair: "", outfit: "???", accessory: "jetpack" }, "someone");
  assert.match(junk.skin, /^#[0-9a-f]{6}$/);
  assert.equal(junk.accessory, "none");
  assert.ok(resolveLook(undefined, "nobody").hairStyle.length > 0);
});
