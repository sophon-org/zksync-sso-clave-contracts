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
        <ZkTableRow v-for="(balance, address) in filteredBalances" :key="address">
          <ZkTableCellData>
            <img
              v-if="balance.token.iconURL"
              :src="balance.token.iconURL"
              alt="Thumbnail"
              class="w-12 h-12 rounded"
            >
            <ZkIconThumbnail
              v-else
              :icon="'account_balance_wallet'"
            />
          </ZkTableCellData>
          <ZkTableCellData class="flex-auto">
            {{ balance.token.symbol }}
            <template #sub v-if="balance.token.name">
              {{ balance.token.name }}
            </template>
          </ZkTableCellData>
          <ZkTableCellData class="text-right">
            <span class="font-bold">
              {{ formatUnits(BigInt(balance.balance), balance.token.decimals) }}
            </span>
            <template #sub>
              {{ (+formatUnits(BigInt(balance.balance) * BigInt(Math.round(balance.token.usdPrice*10000000000)) / BigInt(10000000000), balance.token.decimals)).toLocaleString('en-US', { style: 'currency', currency: 'USD'}) }}
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
import { formatUnits, type Address } from 'viem';

const runtimeConfig = useRuntimeConfig();
const { address } = useAccountStore();
const chainId = runtimeConfig.public.chainId as SupportedChainId;
const assets = ref<GetAddressInfoResponse | null>(null);
const filteredBalances = computed(() => {
  return Object.entries(assets.value?.balances || {})
    .filter(([, balance]) => balance.token !== null)
    .map(([address, balance]) => ({ address, ...balance }));
});

interface GetAddressInfoResponse {
  type: string;
  address: string;
  blockNumber: number;
  balances: {
    [key: Address]: TokenBalance;
  };
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

// Get Address Info
// const getAddressInfoUrl = `${blockExplorerApiByChain[chainId]}/address/${address}`;
const getAddressInfoUrl = `https://block-explorer-api.sepolia.zksync.dev/address/0xF25f95C59f4f1C4010527DAa26e7974cB37c2Ae1`;
const getAddressInfoResponse = await fetch(getAddressInfoUrl);
assets.value = await getAddressInfoResponse.json() as GetAddressInfoResponse;

</script>
