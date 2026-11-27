import type { ContainerStatus, SplitUnit } from "@/db/schema";
import type { ContainerInput } from "@/features/containers/schemas";

export interface ShareRow {
    key: string;
    traderId: string | null;
    shareValue: string;
    goods: string;
    cartons: string;
    weightKg: string;
}

export interface FormValues {
    containerNumber: string;
    shippingLineId: string | null;
    isShared: boolean;
    splitUnit: SplitUnit | null;
    /** A normal container uses shares[0] for its trader and goods. */
    shares: ShareRow[];
    portOfLoadingId: string | null;
    billOfLadingNumber: string;
    containerSizeId: string | null;
    quantity: string;
    faxNumber: string;
    companyPartyId: string | null;
    destination: string;
    registeredOn: string | null;
    expectedArrivalOn: string | null;
    arrivedOn: string | null;
    deliveredOn: string | null;
    notes: string;
}

let seq = 0;
export const newRowKey = () => `r${Date.now().toString(36)}${(seq++).toString(36)}`;

export const emptyShare = (traderId: string | null = null): ShareRow => ({ key: newRowKey(), traderId, shareValue: "", goods: "", cartons: "", weightKg: "" });

export function emptyValues(defaults: { shippingLineId: string | null; portOfLoadingId: string | null; companyPartyId: string | null; registeredOn: string }): FormValues {
    return {
        containerNumber: "",
        shippingLineId: defaults.shippingLineId,
        isShared: false,
        splitUnit: null,
        shares: [emptyShare()],
        portOfLoadingId: defaults.portOfLoadingId,
        billOfLadingNumber: "",
        containerSizeId: null,
        quantity: "1",
        faxNumber: "",
        companyPartyId: defaults.companyPartyId,
        destination: "",
        registeredOn: defaults.registeredOn,
        expectedArrivalOn: null,
        arrivedOn: null,
        deliveredOn: null,
        notes: "",
    };
}

/** What the server's schema reads. */
export function toInput(v: FormValues): ContainerInput {
    return {
        containerNumber: v.containerNumber,
        shippingLineId: v.shippingLineId ?? "",
        isShared: v.isShared,
        splitUnit: v.isShared ? v.splitUnit : null,
        shares: (v.isShared ? v.shares : v.shares.slice(0, 1)).map((s) => ({
            traderId: s.traderId ?? "",
            shareValue: s.shareValue,
            goods: s.goods,
            cartons: s.cartons,
            weightKg: s.weightKg,
        })),
        portOfLoadingId: v.portOfLoadingId,
        billOfLadingNumber: v.billOfLadingNumber,
        containerSizeId: v.containerSizeId,
        quantity: v.quantity,
        faxNumber: v.faxNumber,
        companyPartyId: v.companyPartyId,
        destination: v.destination,
        registeredOn: v.registeredOn,
        expectedArrivalOn: v.expectedArrivalOn,
        arrivedOn: v.arrivedOn,
        deliveredOn: v.deliveredOn,
        notes: v.notes,
    };
}

/** Numbers as the owner sees them: "4.000" → "4", "4500.00" → "4500". */
const trimZeros = (v: string | null) => (v ? v.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") : "");

export function fromContainer(c: {
    containerNumber: string;
    shippingLineId: string;
    isShared: boolean;
    splitUnit: SplitUnit | null;
    shares: { traderId: string; shareValue: string | null; goods: string | null; cartons: number | null; weightKg: string | null }[];
    portOfLoadingId: string | null;
    billOfLadingNumber: string | null;
    containerSizeId: string | null;
    quantity: number;
    faxNumber: string | null;
    companyPartyId: string | null;
    destination: string | null;
    registeredOn: string;
    expectedArrivalOn: string | null;
    arrivedOn: string | null;
    deliveredOn: string | null;
    notes: string | null;
}): FormValues {
    return {
        containerNumber: c.containerNumber,
        shippingLineId: c.shippingLineId,
        isShared: c.isShared,
        splitUnit: c.splitUnit,
        shares: c.shares.map((s) => ({
            key: newRowKey(),
            traderId: s.traderId,
            shareValue: trimZeros(s.shareValue),
            goods: s.goods ?? "",
            cartons: s.cartons === null ? "" : String(s.cartons),
            weightKg: trimZeros(s.weightKg),
        })),
        portOfLoadingId: c.portOfLoadingId,
        billOfLadingNumber: c.billOfLadingNumber ?? "",
        containerSizeId: c.containerSizeId,
        quantity: String(c.quantity),
        faxNumber: c.faxNumber ?? "",
        companyPartyId: c.companyPartyId,
        destination: c.destination ?? "",
        registeredOn: c.registeredOn,
        expectedArrivalOn: c.expectedArrivalOn,
        arrivedOn: c.arrivedOn,
        deliveredOn: c.deliveredOn,
        notes: c.notes ?? "",
    };
}

export type SectionKey = "shipment" | "goods" | "dates";

/** Filled = different from the starting default (so a fresh form reads "0 من 6"). */
export function sectionCounts(v: FormValues, defaults: { companyPartyId: string | null }, status: ContainerStatus | null) {
    const s0 = v.shares[0];
    const shipment = [v.portOfLoadingId, v.billOfLadingNumber.trim(), v.containerSizeId, v.quantity.trim() && v.quantity.trim() !== "1", v.faxNumber.trim(), v.companyPartyId && v.companyPartyId !== defaults.companyPartyId];
    const goods = [s0?.goods.trim(), s0?.cartons.trim(), s0?.weightKg.trim(), v.destination.trim()];
    const dates = [v.registeredOn, v.expectedArrivalOn, v.notes.trim()];
    if (status === "arrived" || status === "delivered") dates.push(v.arrivedOn);
    if (status === "delivered") dates.push(v.deliveredOn);
    const count = (xs: unknown[]) => ({ filled: xs.filter(Boolean).length, total: xs.length });
    return { shipment: count(shipment), goods: count(goods), dates: count(dates) };
}

/** Which section owns a field error key, so it can be opened. */
export function sectionOf(key: string): SectionKey | null {
    if (["portOfLoadingId", "billOfLadingNumber", "containerSizeId", "quantity", "faxNumber", "companyPartyId"].includes(key)) return "shipment";
    if (["destination"].includes(key) || /^shares\.0\.(goods|cartons|weightKg)$/.test(key)) return "goods";
    if (["registeredOn", "expectedArrivalOn", "arrivedOn", "deliveredOn", "notes"].includes(key)) return "dates";
    return null;
}
