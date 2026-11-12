import assert from "node:assert/strict"
import { test } from "node:test"
import { cardHeight, clippedLabels, estimateCardLabelBoxes, SUBTITLE_CHARS_PER_LINE, wrapText } from "../src/lib/label-text.js"

test("text wraps at word boundaries and breaks words longer than a line", () => {
  assert.deepEqual(wrapText("zustand store + history", 22), ["zustand store +", "history"])
  assert.deepEqual(wrapText("abcdefghij", 4), ["abcd", "efgh", "ij"])
  assert.deepEqual(wrapText("   ", 10), [])
})

test("every subtitle the catalog suggests fits, and a two-line subtitle grows the card", () => {
  assert.equal(SUBTITLE_CHARS_PER_LINE, 22)
  const one = { name: "Editor state", subtitle: "zustand store" }
  const two = { name: "Editor state", subtitle: "zustand store + history" }
  assert.deepEqual(clippedLabels(two), [])
  assert.ok(cardHeight(two) > cardHeight(one))
  assert.equal(estimateCardLabelBoxes(two).length, 3, "one name line and two subtitle lines")
  assert.deepEqual(clippedLabels({ name: "Share synchronization worker", subtitle: "x" }), ["name"])
})
