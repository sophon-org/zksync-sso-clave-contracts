import { type AbiFunction, type Address, type Hash, toFunctionSelector, toHex } from "viem";

import { ConstraintCondition, type Limit, LimitType, LimitZero, type SessionConfig } from "../utils/session.js";

type PartialLimit = bigint | {
  limit: bigint;
  period?: bigint;
};

type PartialCallPolicy = {
  address: Address;
  function?: string | AbiFunction;
  selector?: Hash; // if function is not provided
  maxValuePerUse?: bigint;
  valueLimit?: PartialLimit;
  constraints?: {
    index: number;
    condition?: ConstraintCondition | keyof typeof ConstraintCondition;
    refValue?: Hash;
    limit?: PartialLimit;
  }[];
};

type PartialTransferPolicy = {
  to: Address;
  maxValuePerUse?: bigint;
  valueLimit?: PartialLimit;
};

export interface SessionPreferences {
  expiresAt?: bigint | Date;
  fee?: PartialLimit;
  contractCalls?: PartialCallPolicy[];
  transfers?: PartialTransferPolicy[];
};

const formatLimitPreferences = (limit: PartialLimit): Limit => {
  if (typeof limit === "bigint") {
    return {
      limitType: LimitType.Lifetime,
      limit,
      period: 0n,
    };
  }
  if (!limit.period || limit.period == 0n) {
    return {
      limitType: LimitType.Lifetime,
      limit: BigInt(limit.limit),
      period: 0n,
    };
  }
  return {
    limitType: LimitType.Allowance,
    limit: BigInt(limit.limit),
    period: BigInt(limit.period),
  };
};

const formatDatePreferences = (date: bigint | Date): bigint => {
  if (!date) {
    return BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 24); // 24h by default
  }
  if (date instanceof Date) {
    return BigInt(Math.floor(date.getTime() / 1000));
  }
  return BigInt(date);
};

export function formatSessionPreferences(
  preferences: SessionPreferences,
  defaults: {
    expiresAt: bigint;
    fee: Limit;
  },
): Omit<SessionConfig, "signer"> {
  return {
    expiresAt: preferences.expiresAt ? formatDatePreferences(preferences.expiresAt) : defaults.expiresAt,
    feeLimit: preferences.fee ? formatLimitPreferences(preferences.fee) : defaults.fee,
    callPolicies: preferences.contractCalls?.map((policy) => {
      const valueLimit = policy.valueLimit ? formatLimitPreferences(policy.valueLimit) : LimitZero;
      const selector = policy.function ? toFunctionSelector(policy.function) : policy.selector;
      if (!selector) throw new Error("Missing function or selector in contract call policy");
      return {
        target: policy.address,
        maxValuePerUse: policy.maxValuePerUse ?? valueLimit.limit,
        valueLimit,
        selector: selector,
        constraints: policy.constraints?.map((constraint) => ({
          index: BigInt(constraint.index),
          condition: typeof constraint.condition == "string" ? ConstraintCondition[constraint.condition] : (constraint.condition ?? 0),
          refValue: constraint.refValue ?? toHex("", { size: 32 }),
          limit: constraint.limit ? formatLimitPreferences(constraint.limit) : LimitZero,
        })) ?? [],
      };
    }) ?? [],
    transferPolicies: preferences.transfers?.map((policy) => {
      const valueLimit = policy.valueLimit ? formatLimitPreferences(policy.valueLimit) : LimitZero;
      return {
        target: policy.to,
        maxValuePerUse: policy.maxValuePerUse ?? valueLimit.limit,
        valueLimit,
      };
    }) ?? [],
  };
}
