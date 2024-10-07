<template>
  <div class="bg-neutral-50 dark:bg-black">
    <div>
      <app-nav />
    </div>
    <layout-header>
      Settings
      <template #aside>
        <zk-button-icon
          type="secondary"
          icon="dashboard_customize"
        />
      </template>
    </layout-header>
    <layout-section
      title="Passkeys"
      sub="You must have at least one Passkey, but up to 10 are possible."
    >
      <template #aside>
        <zk-button type="secondary">
          <template #prefix>
            <zk-icon icon="add" />
          </template>
          Add
        </zk-button>
      </template>
      <p>
        Lorem
        <zk-link
          to="https://google.com"
          target="_blank"
        >
          Google
        </zk-link>
        Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
      </p>
      <zk-link
        to="https://google.com"
        target="_blank"
        type="primary"
      >
        Google Link
        <zk-icon
          icon="open_in_new"
          class="text-base leading-tight align-text-bottom ml-1"
        />
      </zk-link>
      <zk-link
        to="https://google.com"
        target="_blank"
        type="secondary"
      >
        Google Link
        <zk-icon
          icon="open_in_new"
          class="text-base leading-tight align-text-bottom ml-1"
        />
      </zk-link>
      <zk-link
        to="https://google.com"
        target="_blank"
        type="tertiary"
      >
        Google Link
        <zk-icon
          icon="open_in_new"
          class="text-base leading-tight align-text-bottom ml-1"
        />
      </zk-link>
      <zk-link
        to="https://google.com"
        target="_blank"
        type="ghost"
      >
        Google Link
        <zk-icon
          icon="open_in_new"
          class="text-base leading-tight align-text-bottom ml-1"
        />
      </zk-link>
    </layout-section>

    <div class="pb-12 p-4">
      <h2 class="text-2xl text-bold mt-4 dark:text-white">
        Switch
      </h2>
      <zk-switch
        id="isChecked"
        :is-checked="true"
        @on-switch="checkEmit"
      >
        A Switch
      </zk-switch>
      <zk-switch
        id="isChecked"
        disabled
        :is-checked="true"
        @on-switch="checkEmit"
      >
        A Disabled Switch
      </zk-switch>

      <h2 class="text-2xl text-bold mt-4 dark:text-white">
        Icon
      </h2>
      <zk-icon icon="open_in_new" />
      <zk-icon icon="folder_copy" />
      <zk-icon icon="function" />

      <h2 class="text-2xl text-bold mt-4 dark:text-white">
        Buttons
      </h2>

      <h3 class="text-xl text-bold mt-3 dark:text-white">
        Primary
      </h3>
      <zk-button>Primary Button</zk-button>
      <zk-button disabled>
        Primary Disabled
      </zk-button>

      <h3 class="text-xl text-bold mt-3 dark:text-white">
        Secondary
      </h3>
      <zk-button type="secondary">
        Secondary Button
      </zk-button>
      <zk-button
        type="secondary"
        disabled
      >
        Secondary Disabled
      </zk-button>

      <h3 class="text-xl text-bold mt-3 dark:text-white">
        Tertiary
      </h3>
      <zk-button type="tertiary">
        Tertiary Button
      </zk-button>
      <zk-button
        type="tertiary"
        disabled
      >
        Tertiary Disabled
      </zk-button>

      <h3 class="text-xl text-bold mt-3 dark:text-white">
        Danger
      </h3>
      <zk-button type="danger">
        Danger Button
      </zk-button>
      <zk-button
        type="danger"
        disabled
      >
        Danger Disabled
      </zk-button>

      <h3 class="text-xl text-bold mt-3 dark:text-white">
        Ghost
      </h3>
      <zk-button type="ghost">
        Ghost Button
      </zk-button>
      <zk-button
        type="ghost"
        disabled
      >
        Ghost Disabled
      </zk-button>

      <h3 class="text-xl text-bold mt-3 dark:text-white">
        With icon
      </h3>
      <zk-button type="primary">
        <template #prefix>
          <zk-icon
            icon="switch_access_shortcut"
            ui="rotate-90"
          />
        </template>
        Button with icon
      </zk-button>
      <zk-button type="ghost">
        <template #prefix>
          <zk-icon icon="open_in_new" />
        </template>
        Button with icon
      </zk-button>

      <h3 class="text-xl text-bold mt-3 dark:text-white">
        Icon
      </h3>
      <h4 class="dark:text-white">
        Default (Ghost)
      </h4>
      <zk-button-icon icon="open_in_new" />
      <zk-button-icon
        icon="open_in_new"
        disabled
      />
      <h4 class="dark:text-white">
        Primary
      </h4>
      <zk-button-icon
        type="primary"
        icon="open_in_new"
      />
      <h4 class="dark:text-white">
        Secondary
      </h4>
      <zk-button-icon
        type="secondary"
        icon="open_in_new"
      />
      <h4 class="dark:text-white">
        Tertiary
      </h4>
      <zk-button-icon
        type="tertiary"
        icon="open_in_new"
      />
      <h4 class="dark:text-white">
        Ghost
      </h4>
      <zk-button-icon
        type="ghost"
        icon="open_in_new"
      />
      <h4 class="dark:text-white">
        Danger
      </h4>
      <zk-button-icon
        type="danger"
        icon="open_in_new"
      />

      <h3 class="test-xl text-bold mt-3 dark:text-white">
        Copy Button
      </h3>
      <zk-copy content="Copied content" />

      <h2 class="text-2xl text-bold mt-4 dark:text-white">
        Dropdown
      </h2>

      <zk-dropdown
        :menu="dropdownMenu"
        @select="itemSelected"
      />

      <h2 class="text-2xl text-bold mt-4 dark:text-white">
        Dialog
      </h2>
      <zk-dialog title="Disconnect?">
        Disconnect your username@zksync.eth account?
        <template #submit>
          <zk-button
            type="danger"
            class="w-full"
          >
            <template #prefix>
              <zk-icon icon="logout" />
            </template>
            Disconnect
          </zk-button>
        </template>
      </zk-dialog>

      <h2 class="text-2xl text-bold mt-4 dark:text-white">
        Tabs
      </h2>
      <zk-tabs
        :tabs="[
          { slot: 'tab1', label: 'Tab1', icon: 'shield' },
          { slot: 'tab2', label: 'Tab2', icon: 'settings_account_box' },
          { slot: 'tab3', label: 'Tab3', icon: 'sync_alt' },
        ]"
      >
        <template #tab1>
          I am content for Tab1
        </template>
        <template #tab2>
          I am content for Tab2
        </template>
        <template #tab3>
          I am content for Tab3
        </template>
      </zk-tabs>

      <h2 class="text-2xl text-bold mt-4 dark:text-white">
        Input
      </h2>
      <ZkInput placeholder="Label" />
      <br>
      <ZkInput
        placeholder="Disabled"
        disabled
      />
      <br>
      <ZkInput
        placeholder="Label"
        post-label="@zksync.eth"
      />
      <br>
      <ZkInput
        placeholder="Error"
        state="error"
        :messages="errorMessages"
      />
      <br>
      <ZkInput
        placeholder="Error"
        state="error"
        post-label="@zksync.eth"
      />

      <h2 class="text-2xl text-bold mt-4 dark:text-white">
        Table
      </h2>
      <zk-table-body>
        <zk-table-row>
          <div>
            <img
              src="/demo/avatar-uniswap.png"
              alt="Thumbnail"
            >
          </div>
          <zk-table-cell-data class="flex-auto">
            Something Something
            <template #sub>
              sub text underneath
            </template>
          </zk-table-cell-data>
          <zk-table-cell-data class="text-right">
            0.50
            <template #sub>
              $1,500.00
            </template>
          </zk-table-cell-data>
        </zk-table-row>
        <zk-table-row>
          <div>
            <img
              src="/demo/frame-thumbnail.png"
              alt="Thumbnail"
            >
          </div>
          <zk-table-cell-data class="flex-auto">
            Something Something
            <template #sub>
              sub text underneath
            </template>
          </zk-table-cell-data>
          <zk-table-cell-data class="text-right">
            0.50
            <template #sub>
              $1,500.00
            </template>
          </zk-table-cell-data>
        </zk-table-row>
        <zk-table-row-link>
          <span>A link</span>
        </zk-table-row-link>
        <zk-table-row>
          <div>
            <img
              src="/demo/square-thumbnail.png"
              alt="Thumbnail"
            >
          </div>
          <zk-table-cell-data class="flex-auto">
            Something Something
            <template #sub>
              sub text underneath
            </template>
          </zk-table-cell-data>
          <zk-table-cell-data class="text-right">
            0.50
            <template #sub>
              $1,500.00
            </template>
          </zk-table-cell-data>
        </zk-table-row>
      </zk-table-body>

      <h2 class="text-2xl text-bold mt-4 dark:text-white">
        Panel
      </h2>
      <zk-panel-section
        title="Ecosystem"
        :ui="{ footer: 'flex justify-center' }"
      >
        <template #header-side>
          <zk-button type="secondary">
            View All
          </zk-button>
        </template>
        <zk-table-body>
          <zk-table-row>
            <zk-table-cell-data>
              <zk-icon-thumbnail :icon="'passkey'" />
            </zk-table-cell-data>
            <zk-table-cell-data class="flex-auto">
              Something Something
              <template #sub>
                sub text underneath
              </template>
            </zk-table-cell-data>
            <zk-table-cell-data class="text-right">
              0.50
              <template #sub>
                $1,500.00
              </template>
            </zk-table-cell-data>
          </zk-table-row>
          <zk-table-row>
            <zk-table-cell-data>
              <zk-icon-thumbnail :icon="'account_balance_wallet'" />
            </zk-table-cell-data>
            <zk-table-cell-data class="flex-auto">
              Something Something
              <template #sub>
                sub text underneath
              </template>
            </zk-table-cell-data>
            <zk-table-cell-data class="text-right">
              0.50
              <template #sub>
                $1,500.00
              </template>
            </zk-table-cell-data>
          </zk-table-row>
          <zk-table-row>
            <div>
              <img
                src="/demo/avatar-uniswap.png"
                alt="Thumbnail"
              >
            </div>
            <zk-table-cell-data class="flex-auto">
              Something Something
              <template #sub>
                sub text underneath
              </template>
            </zk-table-cell-data>
            <zk-table-cell-data class="text-right">
              0.50
              <template #sub>
                $1,500.00
              </template>
            </zk-table-cell-data>
          </zk-table-row>
        </zk-table-body>
        <template #footer>
          <zk-button type="secondary">
            View All
          </zk-button>
        </template>
      </zk-panel-section>
      <br>
      <zk-panel-section title="Card panel">
        <template #header-side>
          <zk-button-icon
            icon="settings"
            type="secondary"
          />
        </template>
        <zk-panel-card>
          <div>
            <span class="text-[2em] text-neutral-500">$</span>
            <span class="text-[3em]">12,200</span>
            <span class="text-[2em] text-neutral-500">.25</span>
          </div>
          <p>Card content</p>
          <zk-button
            class="mr-2"
            type="ghost"
          >
            <template #prefix>
              <zk-icon icon="south_west" />
            </template>
            Deposit
          </zk-button>
          <zk-button
            class="mr-2"
            type="ghost"
          >
            <template #prefix>
              <zk-icon icon="north_east" />
            </template>
            Withdraw
          </zk-button>

          <zk-button
            class="mr-2"
            type="ghost"
          >
            <template #prefix>
              <zk-icon
                icon="switch_access_shortcut"
                ui="rotate-90"
              />
            </template>
            Bridge
          </zk-button>
        </zk-panel-card>
      </zk-panel-section>
    </div>
  </div>
</template>

<script setup lang="ts">
const errorMessages = [
  "Long error text that should be as long as the input and then wrap around.",
  "Secondary short text error message.",
];

const dropdownMenu = [
  {
    value: "option1",
    label: "Option 1",
  },
  {
    value: "option2",
    label: "Option 2",
  },
  {
    value: "option3",
    label: "Option 3",
  },
];

function itemSelected(value: string) {
  console.log("Selected", value);
}

function checkEmit(checked: boolean) {
  console.log("Checked", checked);
}
</script>
