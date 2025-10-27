import type {
  VizEventDetail as VizEventDetailBase,
  VizEventName as VizEventNameBase,
} from "../viz/types";

export type VizEventName = VizEventNameBase;
export type VizEventDetail = VizEventDetailBase;

export interface AnalyticsEvent<TDetail> {
  readonly name: VizEventName;
  readonly detail: TDetail;
  readonly isNecessary?: boolean;
}
