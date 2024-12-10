import { Address, type Hex } from "viem"

export type Action = StaticAction | DynamicAction

export type DynamicAction = {
    type: 'dynamic'
    target: Address
    value: number
    callDataBuilderUrl: string
    functionSelector: Hex
    params?: {
      static?: Record<string, any>
      dynamic?: Record<string, any>
    }
  }

export type StaticAction = {
    type: 'static'
    target: Address
    value: number
    callData: Hex
}