import { keyFindings } from "./findings";
import { buildPledgeRows } from "./pledges";
import { buildBillRows } from "./billing";
import { NOW, fixtureData } from "./fixture";
import { groupVillages } from "../villages";

const groups = groupVillages(fixtureData.users);
const pledges = buildPledgeRows(fixtureData, NOW, groups);
const bills = buildBillRows(fixtureData, groups, NOW);
const names = new Map(fixtureData.users.map((u) => [u.id, u.name]));

describe("keyFindings", () => {
  it("writes the findings the data supports, Risk first", () => {
    expect(keyFindings(pledges, bills, names)).toEqual([
      {
        tag: "Risk",
        title: "₹61K of ₹1.4L billed is unpaid",
        detail: "70% of it (₹42.5K) sits on 1 bill whose customer is not in the customer file. The oldest unpaid bill is 268 days old.",
      },
      {
        tag: "Watch",
        title: "Chain is the largest open exposure at ₹55K",
        detail: "63% of the open book. 0% of Chain pledges have been redeemed, against 22% for everything in this view. Average ticket ₹27.5K.",
      },
      {
        tag: "Watch",
        title: "Only 11% of pledges have a photo",
        detail: "₹78K of the open book (6 pledges) has no photo on record.",
      },
      {
        tag: "Upside",
        title: "14% of customers have pledged more than once",
        detail: "1 of 7 customers account for 15% of principal. 0 customers have seven or more pledges.",
      },
      {
        tag: "Upside",
        title: "Billing and pledging serve different customers",
        detail: "Only 1 of 5 billed customers also pledges. Pledge customers are a ready audience for jewellery sales.",
      },
      {
        tag: "Data",
        title: "No new pledge was logged for 8 months",
        detail: "Oct 2024 to May 2025 has no new pledge. Confirm before treating it as a quiet period.",
      },
    ]);
  });

  it("flags an old open book", () => {
    const old = keyFindings(pledges.filter((p) => p.year <= "2025"), [], names);
    expect(old[0]).toEqual({
      tag: "Risk",
      title: "100% of open principal is a year old or more",
      detail: "2 pledges worth ₹15K are past 12 months and 1 pledge worth ₹10K is past 24 months. Redeemed pledges took a median of 180 days.",
    });
  });

  it("says nothing without data", () => {
    expect(keyFindings([], [], names)).toEqual([]);
  });
});
