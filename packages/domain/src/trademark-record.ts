export interface TrademarkRecord {
  readonly id: string;
  readonly sourceRecordId: string;
  readonly corpusSourceCode: string;
  readonly markName: string;
  readonly status: string;
  readonly niceClasses: readonly number[];
  readonly applicationDate: string | null;
  readonly registrationDate: string | null;
  readonly isTextSearchable: boolean;
}

export interface TrademarkGoodsServiceRecord {
  readonly trademarkId: string;
  readonly niceClass: number;
  readonly description: string | null;
  readonly coverage: "full" | "partial" | "unknown";
}
