<template>
  <div>
    <layout-header>
      <span class="font-thin">Welcome to ZKsync SSO</span>
      <template #aside>
        <zk-button-icon
          type="secondary"
          icon="dashboard_customize"
        />
      </template>
    </layout-header>

    <ZkPanelSection
      title="Assets"
      :ui="{ title: 'py-2', footer: 'flex justify-center' }"
    >
      <ZkTableBody>
        <ZkTableRow>
          <ZkTableCellData>
            <img
              src="https://coin-images.coingecko.com/coins/images/279/large/ethereum.png?1696501628"
              alt="Thumbnail"
              class="w-12 h-12 rounded"
            >
          </ZkTableCellData>
          <ZkTableCellData class="flex-auto">
            ETH
            <template #sub>
              Ether
            </template>
          </ZkTableCellData>
          <ZkTableCellData class="text-right">
            <span class="font-bold">8.79566335</span>
            <template #sub>
              $289,544.44
            </template>
          </ZkTableCellData>
        </ZkTableRow>



        <ZkTableRow>
          <ZkTableCellData>
            <ZkIconThumbnail :icon="'account_balance_wallet'" />
          </ZkTableCellData>
          <ZkTableCellData class="flex-auto">
            Something Something
            <template #sub>
              sub text underneath
            </template>
          </ZkTableCellData>
          <ZkTableCellData class="text-right">
            0.50
            <template #sub>
              $1,500.00
            </template>
          </ZkTableCellData>
        </ZkTableRow>
        <ZkTableRow>
          <div>
            <img
              src="/demo/avatar-uniswap.png"
              alt="Thumbnail"
            >
          </div>
          <ZkTableCellData class="flex-auto">
            Something Something
            <template #sub>
              sub text underneath
            </template>
          </ZkTableCellData>
          <ZkTableCellData class="text-right">
            0.50
            <template #sub>
              $1,500.00
            </template>
          </ZkTableCellData>
        </ZkTableRow>
      </ZkTableBody>
      <template #footer>
        <ZkButton type="secondary">
          View All
        </ZkButton>
      </template>
    </ZkPanelSection>
  </div>
</template>

<script setup lang="ts">
import type { Address } from 'viem';

const runtimeConfig = useRuntimeConfig();
const { address } = useAccountStore();

const chainId = runtimeConfig.public.chainId as SupportedChainId;
// const url = `${blockExplorerApiByChain[chainId]}/address/${address}`;
const url = `https://block-explorer-api.sepolia.zksync.dev/address/0xF25f95C59f4f1C4010527DAa26e7974cB37c2Ae1`;

interface GetAddressInfoResponse {
  type: string;
  address: string;
  blockNumber: number;
  balances: Map<Address, TokenBalance>;
  sealedNonce: number;
  verifiedNonce: number;
}

interface TokenBalance {
  balance: string;
  token: Token;
}

interface Token {
  l2Address: string;
  l1Address: string;
  symbol: string;
  name: string;
  decimals: number;
  usdPrice: number;
  liquidity: number;
  iconURL: string;
}

const response = await fetch(url);
const data = await response.json() as GetAddressInfoResponse;
console.log(data);
console.log("data.address");
console.log(data.address);
console.log("data.balances");
console.log(data.balances);
</script>
