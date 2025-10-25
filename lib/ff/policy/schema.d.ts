import type { z } from "zod";

export interface RolloutPolicyStop {
  maxErrorRate?: number;
  maxCLS?: number;
  maxINP?: number;
}

export interface RolloutPolicyHysteresis {
  errorRate?: number;
  CLS?: number;
  INP?: number;
}

export interface RolloutPolicyCanaryMember {
  userId?: string;
  ffAid?: string;
}

export interface RolloutPolicyCanary {
  ttlHours: number;
  cohort: RolloutPolicyCanaryMember[];
}

export interface RolloutPolicy {
  host: string;
  flag: string;
  ns?: string;
  steps: number[];
  stop?: RolloutPolicyStop;
  minSamples?: number;
  coolDownMs?: number;
  hysteresis?: RolloutPolicyHysteresis;
  token?: string;
  shadow?: boolean;
  canary?: RolloutPolicyCanary;
}

export declare const RolloutPolicySchema: z.ZodType<RolloutPolicy>;

export declare class RolloutPolicyValidationError extends Error {
  constructor(message: string, issues: z.ZodIssue[]);
  issues: z.ZodIssue[];
}

export declare function formatRolloutPolicyIssues(issues: z.ZodIssue[]): string;

export declare function parseRolloutPolicy(input: unknown): RolloutPolicy;
