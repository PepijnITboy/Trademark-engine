export interface ProposedGoodsService {
  readonly niceClass: number;
  readonly description?: string;
}

export interface ProposedTrademark {
  readonly markText: string;
  readonly goodsServices?: readonly ProposedGoodsService[];
  readonly localeHints?: readonly string[];
}
