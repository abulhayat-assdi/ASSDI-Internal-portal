import { describe, it, expect } from "vitest";
import {
    canSubmitForTeam,
    effectiveReportDate,
    findGroupForRoll,
    isTeamSubmissionOf,
    isValidReportDate,
    paymentStatusOf,
    pickSchemaData,
    procurementByTeam,
    procurementDue,
    procurementTotals,
    teamRoleOf,
    toReportDate,
    validateFormData,
} from "./competitions";

const schema = [
    { id: "field_date", type: "date", label: "Date", required: true },
    { id: "field_sales", type: "short_text", label: "Total Sales", required: true, validation: "number" },
];

const alpha = {
    id: "g1",
    groupName: "Alpha",
    members: [
        { roll: "101", name: "A", isLeader: true },
        { roll: "102", name: "B", isDeputy: true },
        { roll: "103", name: "C" },
    ],
};
const beta = { id: "g2", groupName: "Beta", members: [{ roll: "201", name: "D", isLeader: true }] };

describe("report dates", () => {
    it("uses the Dhaka day, not the UTC one", () => {
        // 20:30 UTC is already 02:30 the next day in Dhaka.
        expect(toReportDate("2026-10-10T20:30:00Z")).toBe("2026-10-11");
    });

    it("rejects malformed dates", () => {
        expect(isValidReportDate("2026-10-11")).toBe(true);
        expect(isValidReportDate("11/10/2026")).toBe(false);
        expect(isValidReportDate("2026-13-45")).toBe(false);
        expect(isValidReportDate(null)).toBe(false);
    });

    it("prefers the explicit report date, then the form's date answer, then the submit day", () => {
        const submittedAt = "2026-10-11T06:00:00Z";
        expect(effectiveReportDate({ reportDate: "2026-10-09", submittedAt, data: { field_date: "2026-10-08" } }, schema)).toBe("2026-10-09");
        expect(effectiveReportDate({ reportDate: null, submittedAt, data: { field_date: "2026-10-08" } }, schema)).toBe("2026-10-08");
        expect(effectiveReportDate({ reportDate: null, submittedAt, data: {} }, schema)).toBe("2026-10-11");
    });
});

describe("team roles", () => {
    it("finds a student's own team only", () => {
        expect(findGroupForRoll([alpha, beta], "201")?.groupName).toBe("Beta");
        expect(findGroupForRoll([alpha, beta], "999")).toBeNull();
    });

    it("lets only the leader and deputy file the team report", () => {
        expect(canSubmitForTeam(teamRoleOf(alpha, "101"))).toBe(true);
        expect(canSubmitForTeam(teamRoleOf(alpha, "102"))).toBe(true);
        expect(canSubmitForTeam(teamRoleOf(alpha, "103"))).toBe(false);
        expect(canSubmitForTeam(teamRoleOf(alpha, "201"))).toBe(false);
    });

    it("matches team rows by group id, falling back to the name for legacy rows", () => {
        const base = { rollNumber: "101", submittedAt: "2026-10-11T06:00:00Z", data: {} };
        expect(isTeamSubmissionOf({ ...base, type: "team", groupId: "g1", teamName: "Old Name" }, alpha)).toBe(true);
        expect(isTeamSubmissionOf({ ...base, type: "team", groupId: "g2", teamName: "Alpha" }, alpha)).toBe(false);
        expect(isTeamSubmissionOf({ ...base, type: "team", groupId: null, teamName: " Alpha " }, alpha)).toBe(true);
        expect(isTeamSubmissionOf({ ...base, type: "individual", groupId: "g1" }, alpha)).toBe(false);
    });
});

describe("form answers", () => {
    it("drops answers to questions the form does not ask", () => {
        expect(pickSchemaData(schema, { field_sales: "50", rollNumber: "999", absentRolls: ["1"] })).toEqual({ field_sales: "50" });
    });

    it("reports the first invalid answer", () => {
        expect(validateFormData(schema, { field_date: "2026-10-11", field_sales: "50" })).toBeNull();
        expect(validateFormData(schema, { field_date: "2026-10-11" })).toBe("Total Sales is required.");
        expect(validateFormData(schema, { field_date: "2026-10-11", field_sales: "abc" })).toBe("Total Sales must be a number.");
    });
});

describe("procurement money", () => {
    const entries = [
        { groupId: "g2", groupName: "Beta", quantity: 10, totalAmount: 120, paidAmount: 120 },
        { groupId: "g1", groupName: "Alpha", quantity: 5, totalAmount: 60, paidAmount: 20 },
        { groupId: "g1", groupName: "Alpha", quantity: 3, totalAmount: 36.3, paidAmount: 0 },
    ];

    it("derives what is due and never goes negative", () => {
        expect(procurementDue(100, 40)).toBe(60);
        expect(procurementDue(0.3, 0.1)).toBe(0.2);
        expect(procurementDue(50, 80)).toBe(0);
    });

    it("labels a payment paid, due or partial", () => {
        expect(paymentStatusOf(100, 100)).toBe("paid");
        expect(paymentStatusOf(100, 0)).toBe("due");
        expect(paymentStatusOf(100, 40)).toBe("partial");
    });

    it("totals per team and overall", () => {
        expect(procurementTotals(entries)).toEqual({ quantity: 18, total: 216.3, paid: 140, due: 76.3 });
        expect(procurementByTeam(entries)).toEqual([
            { groupId: "g1", groupName: "Alpha", quantity: 8, total: 96.3, paid: 20, due: 76.3 },
            { groupId: "g2", groupName: "Beta", quantity: 10, total: 120, paid: 120, due: 0 },
        ]);
    });
});
