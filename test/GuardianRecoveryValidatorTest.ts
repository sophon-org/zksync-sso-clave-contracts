import { Address, encodeAbiParameters, Hex, parseEther } from "viem";
import { ContractFixtures, getProvider } from "./utils";
import { expect } from "chai";
import { Wallet } from "zksync-ethers";
import { GuardianRecoveryValidator, GuardianRecoveryValidator__factory } from "../typechain-types";
import { HDNodeWallet } from "ethers";

describe("GuardianRecoveryValidator", function () {
    const fixtures = new ContractFixtures();
    let guardiansValidatorAddr: Address;


    this.beforeEach(async () => {
        const guardiansValidator = await fixtures.getGuardianRecoveryValidator();
        guardiansValidatorAddr = await guardiansValidator.getAddress() as Address;
    })

    async function randomWallet(): Promise<[HDNodeWallet, GuardianRecoveryValidator]> {
        const wallet = Wallet.createRandom(getProvider());
        const connected = GuardianRecoveryValidator__factory.connect(guardiansValidatorAddr, wallet)
        await fixtures.wallet.sendTransaction({ value: parseEther("0.2"), to: wallet.address });

        return [wallet, connected]
    }

    async function callAddValidationKey(contract: GuardianRecoveryValidator, account: String): Promise<void> {
        const encoded = encodeAbiParameters(
            [{ type: "address" }],
            [account as Hex]
        )
        const tx = await contract.addValidationKey(encoded);
        await tx.wait();
    }

    it('can propose a guardian', async function() {
        const [user1, connectedUser1] = await randomWallet();
        const [guardian] = await randomWallet();

        const tx = await connectedUser1.proposeValidationKey(guardian.address);
        await tx.wait();

        const res = await connectedUser1.getFunction("guardiansFor").staticCall(user1.address);
        expect(res.length).to.equal(1);
        expect(res[0][0]).to.equal(guardian.address);
        expect(res[0][1]).to.equal(false);
    })

    it("fails when tries to confirm a guardian that was not proposed.", async function () {
        const [user1] = await randomWallet();
        const [_guardian, guardianConnection] = await randomWallet();

        try {
            await callAddValidationKey(guardianConnection, user1.address)
        } catch (e) {
            return expect(e.shortMessage).to.eql("execution reverted: Guardian was not proposed for given account.")
        }
        expect.fail("should have reverted")
    })

    it("fails when tries to confirm a was proposed for a different account.", async function () {
        const [_user1, user1Connection] = await randomWallet();
        const [user2] = await randomWallet();
        const [guardian, guardianConnection] = await randomWallet();

        
        const tx1 = await user1Connection.proposeValidationKey(guardian.address);
        await tx1.wait();

        try {
            await callAddValidationKey(guardianConnection, user2.address)
        } catch (e) {
            return expect(e.shortMessage).to.eql("execution reverted: Guardian was not proposed for given account.")
        }
        expect.fail("should have reverted")
    })

    it("works to confirm a proposed account.", async function () {
        const [user1, user1Connected] = await randomWallet();
        const [guardian, guardianConnected] = await randomWallet();
        console.log(user1.address);

        const tx = await user1Connected.proposeValidationKey(guardian.address);
        await tx.wait();

        
        await callAddValidationKey(guardianConnected, user1.address)
        
        const res = await user1Connected.getFunction("guardiansFor").staticCall(user1.address);
        expect(res.length).to.equal(1);
        expect(res[0][0]).to.equal(guardian.address);
        expect(res[0][1]).to.equal(true);
    })
})