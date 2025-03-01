import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import hre from "hardhat";
import { AddressLike } from "ethers";
import { expect } from "chai";

describe("PiggyBankFactory", function () {
    async function setup() {
        const [deployer, user1, user2] = await hre.ethers.getSigners();

        const tokenFactory1 = await hre.ethers.getContractFactory("Token");
        const _totalSupply = hre.ethers.parseUnits("10000000", 18);

        const token1 = await tokenFactory1.deploy("TokenOne", "ONE");
        await token1.waitForDeployment();
        await token1.mint(deployer.address, _totalSupply)

        const tokenFactory2 = await hre.ethers.getContractFactory("Token");
        const token2 = await tokenFactory2.deploy("TokenTwo", "TWO");
        await token2.waitForDeployment();
        await token2.mint(deployer.address, _totalSupply)

        const tokenFactory3 = await hre.ethers.getContractFactory("Token");
        const token3 = await tokenFactory3.deploy("TokenThree", "THREE");
        await token3.waitForDeployment();
        await token3.mint(deployer.address, _totalSupply)

        const token1Address = await token1.getAddress();
        const token2Address = await token2.getAddress();
        const token3Address = await token3.getAddress();
        
        const tokenAddresses: [AddressLike, AddressLike, AddressLike] = [
            token1Address, 
            token2Address, 
            token3Address
        ];

        const PiggyBankFactory = await hre.ethers.getContractFactory("PiggyFactory");
        const piggyFactory = await PiggyBankFactory.deploy(tokenAddresses);
        await piggyFactory.waitForDeployment();

        
        await token1.transfer(user1.address, hre.ethers.parseUnits("1000", 18));
        await token2.transfer(user1.address, hre.ethers.parseUnits("1000", 18));
        await token3.transfer(user1.address, hre.ethers.parseUnits("1000", 18));

        return { piggyFactory, deployer, user1, user2, token1, token2, token3, tokenAddresses };
    }

    describe("Deployment", () => {
        it("should deploy the Piggy Factory contract", async function () {
            const { piggyFactory, tokenAddresses } = await loadFixture(setup);
            
            expect(await piggyFactory.getAddress()).to.be.properAddress;
            
            
            const supportedTokens = await piggyFactory.getSupportedTokens();
            expect(supportedTokens[0]).to.equal(tokenAddresses[0]);
            expect(supportedTokens[1]).to.equal(tokenAddresses[1]);
            expect(supportedTokens[2]).to.equal(tokenAddresses[2]);
        });

        it("should set the correct owner", async function () {
            const { piggyFactory, deployer } = await loadFixture(setup);
            expect(await piggyFactory.owner()).to.equal(deployer.address);
        });
    });

    describe("Create Piggy Bank", () => {
        it("should create a new piggy bank", async function () {
            const { piggyFactory, user1 } = await loadFixture(setup);
            
            const purpose = "Vacation Fund";
            
            const currentTime = await time.latest();
            const endTime = currentTime + 30 * 24 * 60 * 60; 

            
            await expect(piggyFactory.connect(user1).createPiggyBank(purpose, endTime))
                .to.emit(piggyFactory, "PiggyBankCreated")

            
            const piggyBanks = await piggyFactory.getPiggyBankDetails(user1.address);
            expect(piggyBanks.length).to.equal(1);
            expect(piggyBanks[0].piggyPurpose).to.equal(purpose);
            expect(piggyBanks[0].piggyAddress).to.be.properAddress;
        });

        it("should revert when creating a piggy bank with invalid purpose", async function () {
            const { piggyFactory, user1 } = await loadFixture(setup);
            
            const purpose = "";
            const currentTime = await time.latest();
            const endTime = currentTime + 30 * 24 * 60 * 60;

            await expect(piggyFactory.connect(user1).createPiggyBank(purpose, endTime))
                .to.be.revertedWithCustomError(piggyFactory, "INVALID_PURPOSE");
        });

        it("should revert when creating a piggy bank with past deadline", async function () {
            const { piggyFactory, user1 } = await loadFixture(setup);
            
            const purpose = "Vacation Fund";
            const currentTime = await time.latest();
            const endTime = currentTime - 1; 
            
            await expect(piggyFactory.connect(user1).createPiggyBank(purpose, endTime))
                .to.be.revertedWithCustomError(piggyFactory, "INVALID_DEADLINE");
        });
    });

    describe("Save to Piggy Bank", () => {
        it("should save tokens to a piggy bank", async function () {
            const { piggyFactory, user1, token1 } = await loadFixture(setup);
            
            
            const purpose = "Vacation Fund";
            const currentTime = await time.latest();
            const endTime = currentTime + 30 * 24 * 60 * 60;
            
            await piggyFactory.connect(user1).createPiggyBank(purpose, endTime);
            const piggyBanks = await piggyFactory.getPiggyBankDetails(user1.address);
            const piggyBankAddress = piggyBanks[0].piggyAddress;
            
            
            const amount = hre.ethers.parseUnits("100", 18);
            await token1.connect(user1).approve(await piggyFactory.getAddress(), amount);
            
            
            await expect(piggyFactory.connect(user1).savePiggyBank(piggyBankAddress, await token1.getAddress(), amount))
                .to.emit(piggyFactory, "SavingAdded")
                .withArgs(user1.address, piggyBankAddress, await token1.getAddress(), amount);
            
            
            expect(await token1.balanceOf(piggyBankAddress)).to.equal(amount);
            
            
            const savingsHistory = await piggyFactory.getSavingsHistory(piggyBankAddress);
            expect(savingsHistory.length).to.equal(1);
            expect(savingsHistory[0].amount).to.equal(amount);
            expect(savingsHistory[0].tokenAddress).to.equal(await token1.getAddress());
        });

        it("should revert when saving with invalid address", async function () {
            const { piggyFactory, user1, token1 } = await loadFixture(setup);
            
            const zeroAddress = "0x0000000000000000000000000000000000000000";
            const amount = hre.ethers.parseUnits("100", 18);
            
            await expect(piggyFactory.connect(user1).savePiggyBank(zeroAddress, await token1.getAddress(), amount))
                .to.be.revertedWithCustomError(piggyFactory, "INVALID_ADDRESS");
            
            
            const purpose = "Vacation Fund";
            const currentTime = await time.latest();
            const endTime = currentTime + 30 * 24 * 60 * 60;
            
            await piggyFactory.connect(user1).createPiggyBank(purpose, endTime);
            const piggyBanks = await piggyFactory.getPiggyBankDetails(user1.address);
            const piggyBankAddress = piggyBanks[0].piggyAddress;
            
            await expect(piggyFactory.connect(user1).savePiggyBank(piggyBankAddress, zeroAddress, amount))
                .to.be.revertedWithCustomError(piggyFactory, "INVALID_ADDRESS");
        });

        it("should revert when saving with invalid amount", async function () {
            const { piggyFactory, user1, token1 } = await loadFixture(setup);
            
            
            const purpose = "Vacation Fund";
            const currentTime = await time.latest();
            const endTime = currentTime + 30 * 24 * 60 * 60;
            
            await piggyFactory.connect(user1).createPiggyBank(purpose, endTime);
            const piggyBanks = await piggyFactory.getPiggyBankDetails(user1.address);
            const piggyBankAddress = piggyBanks[0].piggyAddress;
            
            await expect(piggyFactory.connect(user1).savePiggyBank(piggyBankAddress, await token1.getAddress(), 0))
                .to.be.revertedWithCustomError(piggyFactory, "INVALID_AMOUNT");
        });

        it("should revert when saving with insufficient balance", async function () {
            const { piggyFactory, user1, token1, user2 } = await loadFixture(setup);
            
            
            const purpose = "Vacation Fund";
            const currentTime = await time.latest();
            const endTime = currentTime + 30 * 24 * 60 * 60;
            
            await piggyFactory.connect(user1).createPiggyBank(purpose, endTime);
            const piggyBanks = await piggyFactory.getPiggyBankDetails(user1.address);
            const piggyBankAddress = piggyBanks[0].piggyAddress;
            
            
            const amount = hre.ethers.parseUnits("100", 18);
            await token1.connect(user2).approve(await piggyFactory.getAddress(), amount);
            
            await expect(piggyFactory.connect(user2).savePiggyBank(piggyBankAddress, await token1.getAddress(), amount))
                .to.be.reverted;
        });

        it("should revert when saving with insufficient allowance", async function () {
            const { piggyFactory, user1, token1 } = await loadFixture(setup);
            
            
            const purpose = "Vacation Fund";
            const currentTime = await time.latest();
            const endTime = currentTime + 30 * 24 * 60 * 60;
            
            await piggyFactory.connect(user1).createPiggyBank(purpose, endTime);
            const piggyBanks = await piggyFactory.getPiggyBankDetails(user1.address);
            const piggyBankAddress = piggyBanks[0].piggyAddress;
            
            
            const amount = hre.ethers.parseUnits("100", 18);
            
            await expect(piggyFactory.connect(user1).savePiggyBank(piggyBankAddress, await token1.getAddress(), amount))
                .to.be.revertedWithCustomError(piggyFactory, "INVALID_ALLOWANCE");
        });
    });

    describe("Withdraw from Piggy Bank", () => {
        it("should not allow withdrawal before deadline", async function () {
            const { piggyFactory, user1, token1 } = await loadFixture(setup);
            
            
            const purpose = "Vacation Fund";
            const currentTime = await time.latest();
            const endTime = currentTime + 30 * 24 * 60 * 60;
            
            await piggyFactory.connect(user1).createPiggyBank(purpose, endTime);
            const piggyBanks = await piggyFactory.getPiggyBankDetails(user1.address);
            const piggyBankAddress = piggyBanks[0].piggyAddress;
            
            
            const amount = hre.ethers.parseUnits("100", 18);
            await token1.connect(user1).approve(await piggyFactory.getAddress(), amount);
            await piggyFactory.connect(user1).savePiggyBank(piggyBankAddress, await token1.getAddress(), amount);
            
            
            await expect(piggyFactory.connect(user1).withdrawPiggyBank(piggyBankAddress))
                .to.be.revertedWithCustomError(await hre.ethers.getContractAt("Piggy", piggyBankAddress), "DEADLINE_NOT_REACHED");
        });

        it("should allow withdrawal after deadline", async function () {
            const { piggyFactory, user1, token1, deployer } = await loadFixture(setup);
            
            
            const purpose = "Vacation Fund";
            const currentTime = await time.latest();
            const endTime = currentTime + 30 * 24 * 60 * 60;
            
            await piggyFactory.connect(user1).createPiggyBank(purpose, endTime);
            const piggyBanks = await piggyFactory.getPiggyBankDetails(user1.address);
            const piggyBankAddress = piggyBanks[0].piggyAddress;
            
            
            const amount = hre.ethers.parseUnits("100", 18);
            await token1.connect(user1).approve(await piggyFactory.getAddress(), amount);
            await piggyFactory.connect(user1).savePiggyBank(piggyBankAddress, await token1.getAddress(), amount);
            
            
            await time.increaseTo(endTime + 1);
            
            
            const initialUserBalance = await token1.balanceOf(user1.address);
            const initialFactoryBalance = await token1.balanceOf(await piggyFactory.getAddress());
            
            
            await expect(piggyFactory.connect(user1).withdrawPiggyBank(piggyBankAddress))
                .to.emit(piggyFactory, "PiggyBankWithdrawn")
                .withArgs(user1.address, piggyBankAddress);
            
            
            
            const expectedUserAmount = amount * 85n / 100n;
            const expectedFee = amount * 15n / 100n;
            
            expect(await token1.balanceOf(user1.address)).to.equal(initialUserBalance + expectedUserAmount);
            expect(await token1.balanceOf(await piggyFactory.getAddress())).to.equal(initialFactoryBalance + expectedFee);
            expect(await token1.balanceOf(piggyBankAddress)).to.equal(0);
        });

        it("should not allow unauthorized withdrawal", async function () {
            const { piggyFactory, user1, user2, token1 } = await loadFixture(setup);
            
            
            const purpose = "Vacation Fund";
            const currentTime = await time.latest();
            const endTime = currentTime + 30 * 24 * 60 * 60;
            
            await piggyFactory.connect(user1).createPiggyBank(purpose, endTime);
            const piggyBanks = await piggyFactory.getPiggyBankDetails(user1.address);
            const piggyBankAddress = piggyBanks[0].piggyAddress;
            
            
            const amount = hre.ethers.parseUnits("100", 18);
            await token1.connect(user1).approve(await piggyFactory.getAddress(), amount);
            await piggyFactory.connect(user1).savePiggyBank(piggyBankAddress, await token1.getAddress(), amount);
            
            
            await time.increaseTo(endTime + 1);
            
            
            await expect(piggyFactory.connect(user2).withdrawPiggyBank(piggyBankAddress))
                .to.be.revertedWithCustomError(piggyFactory, "UNAUTHORIZED");
        });
    });

    describe("Emergency Withdraw", () => {
        it("should allow emergency withdrawal for non-supported tokens", async function () {
            const { piggyFactory, user1, token1, deployer } = await loadFixture(setup);
            
            
            const tokenFactory = await hre.ethers.getContractFactory("Token");
            const _totalSupply = hre.ethers.parseUnits("10000000", 18);
            const emergencyToken = await tokenFactory.deploy("EmergencyToken", "EMR");
            await emergencyToken.waitForDeployment();

            await emergencyToken.mint(deployer.address, _totalSupply)
            
            
            await emergencyToken.transfer(user1.address, hre.ethers.parseUnits("1000", 18));
            
            
            const purpose = "Vacation Fund";
            const currentTime = await time.latest();
            const endTime = currentTime + 30 * 24 * 60 * 60;
            
            await piggyFactory.connect(user1).createPiggyBank(purpose, endTime);
            const piggyBanks = await piggyFactory.getPiggyBankDetails(user1.address);
            const piggyBankAddress = piggyBanks[0].piggyAddress;
            
            
            
            const amount = hre.ethers.parseUnits("100", 18);
            await emergencyToken.connect(user1).transfer(piggyBankAddress, amount);
            
            
            const initialUserBalance = await emergencyToken.balanceOf(user1.address);
            
            
            const emergencyTokenAddress = await emergencyToken.getAddress();
            await expect(piggyFactory.connect(user1).emergencyWithdrawPiggyBank(piggyBankAddress, [emergencyTokenAddress]))
                .to.emit(piggyFactory, "EmergencyWithdrawal")
                .withArgs(user1.address, piggyBankAddress, [emergencyTokenAddress]);
            
            
            expect(await emergencyToken.balanceOf(user1.address)).to.equal(initialUserBalance + amount);
            expect(await emergencyToken.balanceOf(piggyBankAddress)).to.equal(0);
        });

        it("should not allow emergency withdrawal for supported tokens", async function () {
            const { piggyFactory, user1, token1 } = await loadFixture(setup);
            
            
            const purpose = "Vacation Fund";
            const currentTime = await time.latest();
            const endTime = currentTime + 30 * 24 * 60 * 60;
            
            await piggyFactory.connect(user1).createPiggyBank(purpose, endTime);
            const piggyBanks = await piggyFactory.getPiggyBankDetails(user1.address);
            const piggyBankAddress = piggyBanks[0].piggyAddress;
            
            
            const token1Address = await token1.getAddress();
            await expect(piggyFactory.connect(user1).emergencyWithdrawPiggyBank(piggyBankAddress, [token1Address]))
                .to.be.revertedWithCustomError(piggyFactory, "INVALID_ADDRESS");
        });
    });

    describe("Factory Administration", () => {
        it("should allow owner to set supported tokens", async function () {
            const { piggyFactory, deployer } = await loadFixture(setup);
            
            
            const newTokens: [AddressLike, AddressLike, AddressLike] = [
                "0x1111111111111111111111111111111111111111",
                "0x2222222222222222222222222222222222222222",
                "0x3333333333333333333333333333333333333333"
            ];
            
            
            await expect(piggyFactory.connect(deployer).setSupportedTokens(newTokens))
                .to.emit(piggyFactory, "SupportedTokensUpdated")
                .withArgs(newTokens);
            
            
            const supportedTokens = await piggyFactory.getSupportedTokens();
            expect(supportedTokens[0]).to.equal(newTokens[0]);
            expect(supportedTokens[1]).to.equal(newTokens[1]);
            expect(supportedTokens[2]).to.equal(newTokens[2]);
        });

        it("should not allow non-owner to set supported tokens", async function () {
            const { piggyFactory, user1 } = await loadFixture(setup);
            
            const newTokens: [AddressLike, AddressLike, AddressLike] = [
                "0x1111111111111111111111111111111111111111",
                "0x2222222222222222222222222222222222222222",
                "0x3333333333333333333333333333333333333333"
            ];
            
            await expect(piggyFactory.connect(user1).setSupportedTokens(newTokens))
                .to.be.revertedWithCustomError(piggyFactory, "OwnableUnauthorizedAccount")
                .withArgs(user1.address);
        });

        it("should allow owner to withdraw factory balance", async function () {
            const { piggyFactory, user1, token1, deployer } = await loadFixture(setup);
            
            
            const purpose = "Vacation Fund";
            const currentTime = await time.latest();
            const endTime = currentTime + 30 * 24 * 60 * 60;
            
            await piggyFactory.connect(user1).createPiggyBank(purpose, endTime);
            const piggyBanks = await piggyFactory.getPiggyBankDetails(user1.address);
            const piggyBankAddress = piggyBanks[0].piggyAddress;
            
            
            const amount = hre.ethers.parseUnits("100", 18);
            await token1.connect(user1).approve(await piggyFactory.getAddress(), amount);
            await piggyFactory.connect(user1).savePiggyBank(piggyBankAddress, await token1.getAddress(), amount);
            
            
            await time.increaseTo(endTime + 1);
            
            
            await piggyFactory.connect(user1).withdrawPiggyBank(piggyBankAddress);
            
            
            const factoryBalance = await piggyFactory.getFactoryBalance(await token1.getAddress());
            expect(factoryBalance).to.equal(amount * 15n / 100n); 
            
            
            const receiver = deployer.address;
            const initialReceiverBalance = await token1.balanceOf(receiver);
            
            await expect(piggyFactory.connect(deployer).withdrawFactoryBalance(
                await token1.getAddress(), 
                receiver, 
                factoryBalance
            ))
                .to.emit(piggyFactory, "FactoryBalanceWithdrawn")
                .withArgs(await token1.getAddress(), receiver, factoryBalance);
            
            
            expect(await token1.balanceOf(receiver)).to.equal(initialReceiverBalance + factoryBalance);
            expect(await piggyFactory.getFactoryBalance(await token1.getAddress())).to.equal(0);
        });

        it("should not allow non-owner to withdraw factory balance", async function () {
            const { piggyFactory, user1, token1 } = await loadFixture(setup);
            
            const amount = hre.ethers.parseUnits("100", 18);
            
            await expect(piggyFactory.connect(user1).withdrawFactoryBalance(
                await token1.getAddress(), 
                user1.address, 
                amount
            ))
                .to.be.revertedWithCustomError(piggyFactory, "OwnableUnauthorizedAccount")
                .withArgs(user1.address);
        });
    });
});