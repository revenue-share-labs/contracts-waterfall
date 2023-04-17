import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  RSCWaterfall,
  RSCWaterfallFactory,
  RSCWaterfallFactory__factory,
  TestToken,
  TestToken__factory,
  MockReceiver,
  MockReceiver__factory,
} from "../typechain-types";
import { snapshot } from "./utils";

describe("RSC Waterfall tests", function () {
  let rscWaterfall: RSCWaterfall,
    baseToken: TestToken,
    testToken: TestToken,
    owner: SignerWithAddress,
    alice: SignerWithAddress,
    bob: SignerWithAddress,
    addr3: SignerWithAddress,
    addr4: SignerWithAddress,
    addr5: SignerWithAddress,
    snapId: string;

  async function deployRSCWaterfallContract(
    controller: any,
    distributors: any,
    immutableController: any,
    autoNativeTokenDistribution: any,
    minAutoDistributeAmount: any,
    initialRecipients: any,
    maxCaps: any,
    priorities: any,
    supportedErc20addresses: any
  ) {
    const EthPriceFeedMock = await ethers.getContractFactory(
      "EthPriceFeedMock"
    );
    const ethPriceFeedMock = await EthPriceFeedMock.deploy();
    await ethPriceFeedMock.deployed();

    const RSCWaterfallFactory = await ethers.getContractFactory(
      "RSCWaterfallFactory"
    );
    const rscWaterfallFactory = await RSCWaterfallFactory.deploy();

    const tx = await rscWaterfallFactory.createRSCWaterfall({
      controller: controller,
      distributors: distributors,
      immutableController: immutableController,
      autoNativeTokenDistribution: autoNativeTokenDistribution,
      minAutoDistributeAmount: minAutoDistributeAmount,
      initialRecipients: initialRecipients,
      maxCaps: maxCaps,
      priorities: priorities,
      supportedErc20addresses: supportedErc20addresses,
      erc20PriceFeeds: [ethPriceFeedMock.address],
      creationId: ethers.constants.HashZero,
    });

    let receipt = await tx.wait();
    const rscWaterfallContractAddress = receipt.events?.[5].args?.[0];

    const RSCWaterfall = await ethers.getContractFactory("RSCWaterfall");
    const rscWaterfall = await RSCWaterfall.attach(rscWaterfallContractAddress);
    return rscWaterfall;
  }

  before(async () => {
    [owner, alice, bob, addr3, addr4, addr5] = await ethers.getSigners();

    baseToken = await new TestToken__factory(owner).deploy(
      "BaseToken",
      "BTKN",
      1000000000
    );
    testToken = await new TestToken__factory(owner).deploy(
      "TestToken",
      "TTT",
      1000000000
    );

    rscWaterfall = await deployRSCWaterfallContract(
      owner.address,
      [owner.address],
      false,
      true,
      ethers.utils.parseEther("1"),
      [alice.address, bob.address],
      [ethers.utils.parseEther("100"), ethers.utils.parseEther("10")],
      [BigInt(10), BigInt(20)],
      [baseToken.address]
    );
  });

  beforeEach(async () => {
    snapId = await snapshot.take();
  });

  afterEach(async () => {
    await snapshot.restore(snapId);
  });

  it("Should set base attrs correctly", async () => {
    // Contract settings
    expect(await rscWaterfall.owner()).to.be.equal(owner.address);
    expect(await rscWaterfall.distributors(owner.address)).to.be.true;
    expect(await rscWaterfall.controller()).to.be.equal(owner.address);
    expect(await rscWaterfall.numberOfRecipients()).to.be.equal(BigInt(1));
    expect(await rscWaterfall.platformFee()).to.be.equal(0);

    // Recipients settings
    expect(await rscWaterfall.currentRecipient()).to.be.equal(bob.address);
    expect(await rscWaterfall.recipients(0)).to.be.equal(alice.address);
    expect(
      (await rscWaterfall.recipientsData(alice.address)).maxCap
    ).to.be.equal(ethers.utils.parseEther("100"));
    expect(
      (await rscWaterfall.recipientsData(alice.address)).received
    ).to.be.equal(0);
    expect(
      (await rscWaterfall.recipientsData(alice.address)).priority
    ).to.be.equal(10);

    expect((await rscWaterfall.recipientsData(bob.address)).maxCap).to.be.equal(
      ethers.utils.parseEther("10")
    );
    expect(
      (await rscWaterfall.recipientsData(bob.address)).received
    ).to.be.equal(0);
    expect(
      (await rscWaterfall.recipientsData(bob.address)).priority
    ).to.be.equal(20);
  });

  it("Should add recipients correctly", async () => {
    await expect(
      rscWaterfall
        .connect(addr3)
        .setRecipients([addr3.address], [2000], [BigInt(10)])
    ).to.be.revertedWithCustomError(rscWaterfall, "OnlyControllerError");

    await rscWaterfall.setRecipients(
      [alice.address, addr3.address],
      [ethers.utils.parseEther("100"), ethers.utils.parseEther("50")],
      [BigInt(30), BigInt(20)]
    );

    expect(await rscWaterfall.numberOfRecipients()).to.be.equal(BigInt(2));
    expect(await rscWaterfall.currentRecipient()).to.be.equal(bob.address);
    expect(await rscWaterfall.recipients(0)).to.be.equal(alice.address);
    expect(
      (await rscWaterfall.recipientsData(alice.address)).maxCap
    ).to.be.equal(ethers.utils.parseEther("100"));
    expect(
      (await rscWaterfall.recipientsData(alice.address)).received
    ).to.be.equal(0);
    expect(
      (await rscWaterfall.recipientsData(alice.address)).priority
    ).to.be.equal(30);

    expect(await rscWaterfall.recipients(1)).to.be.equal(addr3.address);
    expect(
      (await rscWaterfall.recipientsData(addr3.address)).maxCap
    ).to.be.equal(ethers.utils.parseEther("50"));
    expect(
      (await rscWaterfall.recipientsData(addr3.address)).received
    ).to.be.equal(0);
    expect(
      (await rscWaterfall.recipientsData(addr3.address)).priority
    ).to.be.equal(20);

    await expect(rscWaterfall.recipients(2)).to.be.revertedWithoutReason();

    await expect(
      rscWaterfall.setRecipients(
        [alice.address, alice.address],
        [ethers.utils.parseEther("100"), ethers.utils.parseEther("50")],
        [BigInt(30), BigInt(20)]
      )
    ).to.be.revertedWithCustomError(rscWaterfall, "RecipientAlreadyAddedError");
  });

  it("Should redistribute funds correctly", async () => {
    // First Buy
    // Send 1/2 of max cap to bob

    const aliceBalanceBefore = (
      await ethers.provider.getBalance(alice.address)
    ).toBigInt();
    const bobBalanceBefore = (
      await ethers.provider.getBalance(bob.address)
    ).toBigInt();

    const txHashFirstBuy = await owner.sendTransaction({
      to: rscWaterfall.address,
      value: ethers.utils.parseEther("5"),
    });

    const aliceBalanceAfterFirstBuy = (
      await ethers.provider.getBalance(alice.address)
    ).toBigInt();
    const bobBalanceAfterFirstBuy = (
      await ethers.provider.getBalance(bob.address)
    ).toBigInt();

    expect(aliceBalanceBefore).to.be.equal(aliceBalanceAfterFirstBuy);
    expect(
      bobBalanceBefore + ethers.utils.parseEther("5").toBigInt()
    ).to.be.equal(bobBalanceAfterFirstBuy);

    expect(await rscWaterfall.currentRecipient()).to.be.equal(bob.address);

    expect(
      (await rscWaterfall.recipientsData(bob.address)).received
    ).to.be.equal(ethers.utils.parseEther("5"));

    // Second Buy
    // Send rest of max cap to bob, should switch currentRecipient to alice

    const txHashSecondBuy = await owner.sendTransaction({
      to: rscWaterfall.address,
      value: ethers.utils.parseEther("5"),
    });

    const aliceBalanceAfterSecondBuy = (
      await ethers.provider.getBalance(alice.address)
    ).toBigInt();
    const bobBalanceAfterSecondBuy = (
      await ethers.provider.getBalance(bob.address)
    ).toBigInt();

    expect(aliceBalanceBefore).to.be.equal(aliceBalanceAfterSecondBuy);

    expect(
      bobBalanceAfterFirstBuy + ethers.utils.parseEther("5").toBigInt()
    ).to.be.equal(bobBalanceAfterSecondBuy);

    expect(await rscWaterfall.currentRecipient()).to.be.equal(alice.address);
    await expect(rscWaterfall.recipients(0)).to.revertedWithoutReason();
    expect(
      (await rscWaterfall.recipientsData(alice.address)).received
    ).to.be.equal(0);

    // "third Buy"
    // send 1/99 to alice, should stay as current recipient

    const txHashThirdBuy = await owner.sendTransaction({
      to: rscWaterfall.address,
      value: ethers.utils.parseEther("1"),
    });

    const aliceBalanceAfterThirdBuy = (
      await ethers.provider.getBalance(alice.address)
    ).toBigInt();
    const bobBalanceAfterThirdBuy = (
      await ethers.provider.getBalance(bob.address)
    ).toBigInt();

    expect(await rscWaterfall.currentRecipient()).to.be.equal(alice.address);
    expect(
      (await rscWaterfall.recipientsData(alice.address)).received
    ).to.be.equal(ethers.utils.parseEther("1"));

    // Fourth buy
    // send rest to alice and 1 eth on top, currentRecipient should be ZERO_ADDRESS because there are no more recipients
    // contract should have balance of 1

    const txHashFourthBuy = await owner.sendTransaction({
      to: rscWaterfall.address,
      value: ethers.utils.parseEther("100"),
    });

    const aliceBalanceAfterFourthBuy = (
      await ethers.provider.getBalance(alice.address)
    ).toBigInt();
    const bobBalanceAfterFourthBuy = (
      await ethers.provider.getBalance(bob.address)
    ).toBigInt();
    const rscContractBalance = (
      await ethers.provider.getBalance(rscWaterfall.address)
    ).toBigInt();

    expect(rscContractBalance).to.be.equal(ethers.utils.parseEther("1"));
    expect(await rscWaterfall.currentRecipient()).to.be.equal(
      ethers.constants.AddressZero
    );
    await expect(rscWaterfall.recipients(0)).to.revertedWithoutReason();

    // Fifth buy
    // Send 4 Eth to RSC, because there is no currentRecipient all eth will be send to contract

    const txHashFifthBuy = await owner.sendTransaction({
      to: rscWaterfall.address,
      value: ethers.utils.parseEther("4"),
    });

    const rscContractBalanceEmptyBuy = (
      await ethers.provider.getBalance(rscWaterfall.address)
    ).toBigInt();
    expect(rscContractBalanceEmptyBuy).to.be.equal(
      ethers.utils.parseEther("5")
    );

    // Sixth buy
    // Set new recipients and currentRecipient (addr3) should receive 5 eth from RSC contract
    await rscWaterfall.setRecipients(
      [addr3.address],
      [ethers.utils.parseEther("10")],
      [BigInt(10)]
    );

    const addr3BalanceBefore = (
      await ethers.provider.getBalance(addr3.address)
    ).toBigInt();

    const txHashSixthBuy = await owner.sendTransaction({
      to: rscWaterfall.address,
      value: ethers.utils.parseEther("5"),
    });

    const addr3BalanceAfter = (
      await ethers.provider.getBalance(addr3.address)
    ).toBigInt();

    expect(await ethers.provider.getBalance(rscWaterfall.address)).to.be.equal(
      0
    );
    expect(
      addr3BalanceBefore + ethers.utils.parseEther("10").toBigInt()
    ).to.be.equal(addr3BalanceAfter);
    expect(await rscWaterfall.currentRecipient()).to.be.equal(
      ethers.constants.AddressZero
    );

    // Seventh buy
    // Set 3 recipients and 2 of them should be fulfilled in 1 TX
    await rscWaterfall.setRecipients(
      [alice.address, bob.address, addr3.address],
      [
        ethers.utils.parseEther("10"),
        ethers.utils.parseEther("10"),
        ethers.utils.parseEther("10"),
      ],
      [BigInt(30), BigInt(20), BigInt(10)]
    );

    const aliceBalanceBeforeSeventhdBuy = (
      await ethers.provider.getBalance(alice.address)
    ).toBigInt();
    const bobBalanceBeforeSeventhdBuy = (
      await ethers.provider.getBalance(bob.address)
    ).toBigInt();
    const addr3BalanceBeforeSeventhdBuy = (
      await ethers.provider.getBalance(addr3.address)
    ).toBigInt();

    const txHashSeventhBuy = await owner.sendTransaction({
      to: rscWaterfall.address,
      value: ethers.utils.parseEther("25"),
    });

    const aliceBalanceAfterSeventhdBuy = (
      await ethers.provider.getBalance(alice.address)
    ).toBigInt();
    const bobBalanceAfterSeventhdBuy = (
      await ethers.provider.getBalance(bob.address)
    ).toBigInt();
    const addr3BalanceAfterSeventhdBuy = (
      await ethers.provider.getBalance(addr3.address)
    ).toBigInt();

    expect(await rscWaterfall.numberOfRecipients()).to.be.equal(BigInt(0));
    expect(await rscWaterfall.currentRecipient()).to.be.equal(addr3.address);
    expect(
      (await ethers.provider.getBalance(rscWaterfall.address)).toBigInt()
    ).to.be.equal(0);

    expect(
      aliceBalanceBeforeSeventhdBuy + ethers.utils.parseEther("10").toBigInt()
    ).to.be.equal(aliceBalanceAfterSeventhdBuy);
    expect(
      bobBalanceBeforeSeventhdBuy + ethers.utils.parseEther("10").toBigInt()
    ).to.be.equal(bobBalanceAfterSeventhdBuy);
    expect(
      addr3BalanceBeforeSeventhdBuy + ethers.utils.parseEther("5").toBigInt()
    ).to.be.equal(addr3BalanceAfterSeventhdBuy);

    expect(
      (await rscWaterfall.recipientsData(addr3.address)).received
    ).to.be.equal(ethers.utils.parseEther("5"));

    // TODO Test set recipients between buyes
  });

  it("Should redistribute ERC20 token", async () => {
    const EthPriceFeedMock = await ethers.getContractFactory(
      "EthPriceFeedMock"
    );
    const ethPriceFeedMock = await EthPriceFeedMock.deploy();
    await ethPriceFeedMock.deployed();

    await baseToken.transfer(
      rscWaterfall.address,
      ethers.utils.parseEther("100000")
    );

    await rscWaterfall.setTokenNativeTokenPriceFeed(
      baseToken.address,
      ethPriceFeedMock.address
    );
    await rscWaterfall.redistributeToken(baseToken.address);

    expect(await baseToken.balanceOf(rscWaterfall.address)).to.be.equal(0);
    expect(await baseToken.balanceOf(alice.address)).to.be.equal(0);
    expect(await baseToken.balanceOf(bob.address)).to.be.equal(
      ethers.utils.parseEther("100000")
    );
    expect(await rscWaterfall.currentRecipient()).to.be.equal(alice.address);
    expect(await rscWaterfall.numberOfRecipients()).to.be.equal(BigInt(0));

    await baseToken.transfer(
      rscWaterfall.address,
      ethers.utils.parseEther("1050000")
    );
    await rscWaterfall.redistributeToken(baseToken.address);
    expect(await baseToken.balanceOf(rscWaterfall.address)).to.be.equal(
      ethers.utils.parseEther("50000")
    );
    expect(await baseToken.balanceOf(alice.address)).to.be.equal(
      ethers.utils.parseEther("1000000")
    );
    expect(await baseToken.balanceOf(bob.address)).to.be.equal(
      ethers.utils.parseEther("100000")
    );

    await rscWaterfall.setRecipients(
      [addr3.address],
      [ethers.utils.parseEther("10000")],
      [BigInt(10)]
    );
    await testToken.transfer(
      rscWaterfall.address,
      ethers.utils.parseEther("100")
    );
    await expect(
      rscWaterfall.redistributeToken(testToken.address)
    ).to.be.revertedWithCustomError(
      rscWaterfall,
      "TokenMissingNativeTokenPriceOracle"
    );

    await expect(
      rscWaterfall.connect(alice).redistributeToken(baseToken.address)
    ).to.be.revertedWithCustomError(rscWaterfall, "OnlyDistributorError");

    await expect(
      rscWaterfall.connect(alice).setDistributor(addr3.address, true)
    ).to.be.revertedWith("Ownable: caller is not the owner");

    await rscWaterfall.setDistributor(alice.address, true);
    await rscWaterfall.connect(alice).redistributeToken(baseToken.address);
  });

  it("Should initialize only once", async () => {
    await expect(
      rscWaterfall.initialize(
        {
          owner: bob.address,
          controller: bob.address,
          _distributors: [bob.address],
          immutableController: true,
          autoNativeTokenDistribution: false,
          minAutoDistributionAmount: ethers.utils.parseEther("1"),
          platformFee: BigInt(0),
          factoryAddress: alice.address,
          supportedErc20addresses: [],
          erc20PriceFeeds: [],
        },
        [alice.address],
        [BigInt(10000)],
        [BigInt(10)]
      )
    ).to.be.revertedWith("Initializable: contract is already initialized");
  });

  it("Should transfer ownership correctly", async () => {
    await rscWaterfall.transferOwnership(alice.address);
    expect(await rscWaterfall.owner()).to.be.equal(alice.address);
  });

  it("Should deploy and create immutable contract", async () => {
    const rscWaterfallImmutable = await deployRSCWaterfallContract(
      ethers.constants.AddressZero,
      [owner.address],
      true,
      true,
      ethers.utils.parseEther("1"),
      [alice.address, bob.address],
      [ethers.utils.parseEther("100"), ethers.utils.parseEther("10")],
      [BigInt(10), BigInt(20)],
      [baseToken.address]
    );

    await expect(
      rscWaterfallImmutable.setRecipients(
        [alice.address, bob.address],
        [ethers.utils.parseEther("100"), ethers.utils.parseEther("10")],
        [BigInt(10), BigInt(20)]
      )
    ).to.be.revertedWithCustomError(
      rscWaterfallImmutable,
      "OnlyControllerError"
    );

    await expect(
      rscWaterfallImmutable.connect(bob).setController(bob.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(
      rscWaterfallImmutable.setController(alice.address)
    ).to.be.revertedWithCustomError(
      rscWaterfallImmutable,
      "ImmutableControllerError"
    );
  });

  it("Should create manual distribution split", async () => {
    const rscWaterfallManualDistribution = await deployRSCWaterfallContract(
      owner.address,
      [owner.address],
      false,
      false,
      ethers.utils.parseEther("1"),
      [alice.address, bob.address],
      [ethers.utils.parseEther("100"), ethers.utils.parseEther("50")],
      [BigInt(10), BigInt(20)],
      [baseToken.address]
    );

    const transactionHash = await owner.sendTransaction({
      to: rscWaterfallManualDistribution.address,
      value: ethers.utils.parseEther("50"),
    });

    const contractBalance = (
      await ethers.provider.getBalance(rscWaterfallManualDistribution.address)
    ).toBigInt();
    expect(contractBalance).to.be.equal(ethers.utils.parseEther("50"));

    await expect(
      rscWaterfallManualDistribution.connect(addr3).redistributeNativeToken()
    ).to.be.revertedWithCustomError(
      rscWaterfallManualDistribution,
      "OnlyDistributorError"
    );

    const priorityRecipientBeforeBalance = (
      await ethers.provider.getBalance(bob.address)
    ).toBigInt();
    await rscWaterfallManualDistribution.redistributeNativeToken();

    const contractBalance2 = (
      await ethers.provider.getBalance(rscWaterfallManualDistribution.address)
    ).toBigInt();
    expect(contractBalance2).to.be.equal(0);

    const investorBalanceAfter = (
      await ethers.provider.getBalance(bob.address)
    ).toBigInt();
    expect(investorBalanceAfter).to.be.equal(
      priorityRecipientBeforeBalance + ethers.utils.parseEther("50").toBigInt()
    );
  });

  it("Should work with fees Correctly", async () => {
    const RSCWaterfallFeeFactory = await ethers.getContractFactory(
      "RSCWaterfallFactory"
    );
    const rscWaterfallFeeFactory = await RSCWaterfallFeeFactory.deploy();
    await rscWaterfallFeeFactory.deployed();

    await expect(
      rscWaterfallFeeFactory.connect(alice).setPlatformFee(BigInt(1))
    ).to.be.revertedWith("Ownable: caller is not the owner");

    await expect(
      rscWaterfallFeeFactory.setPlatformFee(BigInt(10000001))
    ).to.be.revertedWithCustomError(
      rscWaterfallFeeFactory,
      "InvalidFeePercentage"
    );

    await expect(
      rscWaterfallFeeFactory.connect(alice).setPlatformWallet(bob.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");

    await rscWaterfallFeeFactory.setPlatformWallet(addr4.address);
    await rscWaterfallFeeFactory.setPlatformFee(BigInt(5000000));

    const platformWallet = addr4.address;
    expect(await rscWaterfallFeeFactory.platformWallet()).to.be.equal(
      platformWallet
    );
    expect(await rscWaterfallFeeFactory.platformFee()).to.be.equal(
      BigInt(5000000)
    );

    const EthPriceFeedMock = await ethers.getContractFactory(
      "EthPriceFeedMock"
    );
    const ethPriceFeedMock = await EthPriceFeedMock.deploy();
    await ethPriceFeedMock.deployed();

    const txFee = await rscWaterfallFeeFactory.createRSCWaterfall({
      controller: owner.address,
      distributors: [owner.address],
      immutableController: false,
      autoNativeTokenDistribution: true,
      minAutoDistributeAmount: ethers.utils.parseEther("1"),
      initialRecipients: [alice.address, bob.address],
      maxCaps: [ethers.utils.parseEther("50"), ethers.utils.parseEther("10")],
      priorities: [BigInt(10), BigInt(20)],
      supportedErc20addresses: [baseToken.address],
      erc20PriceFeeds: [ethPriceFeedMock.address],
      creationId: ethers.constants.HashZero,
    });

    let receipt = await txFee.wait();
    const revenueShareContractAddress = receipt.events?.[5].args?.[0];
    const RevenueShareContract = await ethers.getContractFactory(
      "RSCWaterfall"
    );
    const rscFeeWaterfall = await RevenueShareContract.attach(
      revenueShareContractAddress
    );

    const platformWalletBalanceBefore = (
      await ethers.provider.getBalance(platformWallet)
    ).toBigInt();
    const bobBalanceBefore = (
      await ethers.provider.getBalance(bob.address)
    ).toBigInt();
    const aliceBalanceBefore = (
      await ethers.provider.getBalance(alice.address)
    ).toBigInt();

    const transactionHash = await owner.sendTransaction({
      to: rscFeeWaterfall.address,
      value: ethers.utils.parseEther("50"),
    });

    const platformWalletBalanceAfter = (
      await ethers.provider.getBalance(platformWallet)
    ).toBigInt();
    const bobBalanceAfter = (
      await ethers.provider.getBalance(bob.address)
    ).toBigInt();
    const aliceBalanceAfter = (
      await ethers.provider.getBalance(alice.address)
    ).toBigInt();

    expect(platformWalletBalanceAfter).to.be.equal(
      platformWalletBalanceBefore + ethers.utils.parseEther("25").toBigInt()
    );
    expect(bobBalanceAfter).to.be.equal(
      bobBalanceBefore + ethers.utils.parseEther("10").toBigInt()
    );
    expect(aliceBalanceAfter).to.be.equal(
      aliceBalanceBefore + ethers.utils.parseEther("15").toBigInt()
    );

    await baseToken.transfer(
      rscFeeWaterfall.address,
      ethers.utils.parseEther("1000000")
    );

    await rscFeeWaterfall.redistributeToken(baseToken.address);

    expect(await baseToken.balanceOf(platformWallet)).to.be.equal(
      ethers.utils.parseEther("500000")
    );
    expect(await baseToken.balanceOf(rscFeeWaterfall.address)).to.be.equal(
      ethers.utils.parseEther("150000")
    );
    expect(await baseToken.balanceOf(alice.address)).to.be.equal(
      ethers.utils.parseEther("350000")
    );
  });

  it("Should work with creation ID correctly", async () => {
    const RSCWaterfallCreationIdFactory = await ethers.getContractFactory(
      "RSCWaterfallFactory"
    );
    const rscWaterfallCreationIdFactory =
      await RSCWaterfallCreationIdFactory.deploy();
    await rscWaterfallCreationIdFactory.deployed();

    const EthPriceFeedMock = await ethers.getContractFactory(
      "EthPriceFeedMock"
    );
    const ethPriceFeedMock = await EthPriceFeedMock.deploy();
    await ethPriceFeedMock.deployed();

    await rscWaterfallCreationIdFactory.createRSCWaterfall({
      controller: owner.address,
      distributors: [owner.address],
      immutableController: false,
      autoNativeTokenDistribution: true,
      minAutoDistributeAmount: ethers.utils.parseEther("1"),
      initialRecipients: [alice.address, bob.address],
      maxCaps: [ethers.utils.parseEther("50"), ethers.utils.parseEther("10")],
      priorities: [BigInt(10), BigInt(20)],
      supportedErc20addresses: [baseToken.address],
      erc20PriceFeeds: [ethPriceFeedMock.address],
      creationId: ethers.utils.formatBytes32String("test-creation-id-1"),
    });

    await expect(
      rscWaterfallCreationIdFactory.createRSCWaterfall({
        controller: owner.address,
        distributors: [owner.address],
        immutableController: false,
        autoNativeTokenDistribution: true,
        minAutoDistributeAmount: ethers.utils.parseEther("1"),
        initialRecipients: [alice.address, bob.address],
        maxCaps: [ethers.utils.parseEther("50"), ethers.utils.parseEther("10")],
        priorities: [BigInt(10), BigInt(20)],
        supportedErc20addresses: [baseToken.address],
        erc20PriceFeeds: [ethPriceFeedMock.address],
        creationId: ethers.utils.formatBytes32String("test-creation-id-1"),
      })
    ).to.be.revertedWithCustomError(
      rscWaterfallCreationIdFactory,
      "CreationIdAlreadyProcessed"
    );

    await rscWaterfallCreationIdFactory.createRSCWaterfall({
      controller: owner.address,
      distributors: [owner.address],
      immutableController: false,
      autoNativeTokenDistribution: true,
      minAutoDistributeAmount: ethers.utils.parseEther("1"),
      initialRecipients: [alice.address, bob.address],
      maxCaps: [ethers.utils.parseEther("50"), ethers.utils.parseEther("10")],
      priorities: [BigInt(10), BigInt(20)],
      supportedErc20addresses: [baseToken.address],
      erc20PriceFeeds: [ethPriceFeedMock.address],
      creationId: ethers.utils.formatBytes32String("test-creation-id-2"),
    });
  });

  it("Should recursively erc20 split", async () => {
    const rscWaterfallSecond = await deployRSCWaterfallContract(
      owner.address,
      [owner.address],
      false,
      false,
      ethers.utils.parseEther("1"),
      [alice.address, bob.address],
      [ethers.utils.parseEther("100"), ethers.utils.parseEther("50")],
      [BigInt(10), BigInt(20)],
      [baseToken.address]
    );

    const rscWaterfallMain = await deployRSCWaterfallContract(
      owner.address,
      [owner.address],
      false,
      false,
      ethers.utils.parseEther("1"),
      [rscWaterfallSecond.address, alice.address],
      [ethers.utils.parseEther("10"), ethers.utils.parseEther("90")],
      [BigInt(20), BigInt(10)],
      [baseToken.address]
    );

    await baseToken.transfer(
      rscWaterfallMain.address,
      ethers.utils.parseEther("1000000")
    );
    await baseToken.transfer(
      rscWaterfallSecond.address,
      ethers.utils.parseEther("1000000")
    );

    await rscWaterfallSecond.setDistributor(rscWaterfallMain.address, true);
    await rscWaterfallMain.redistributeToken(baseToken.address);

    expect(await baseToken.balanceOf(rscWaterfallMain.address)).to.be.equal(0);
    expect(await baseToken.balanceOf(rscWaterfallSecond.address)).to.be.equal(
      0
    );
  });

  it("Should recursively split ETH", async () => {
    const rscWaterfallSecond = await deployRSCWaterfallContract(
      owner.address,
      [owner.address],
      false,
      false,
      ethers.utils.parseEther("1"),
      [alice.address, bob.address],
      [ethers.utils.parseEther("100"), ethers.utils.parseEther("50")],
      [BigInt(10), BigInt(20)],
      [baseToken.address]
    );

    const rscWaterfallMain = await deployRSCWaterfallContract(
      owner.address,
      [owner.address],
      false,
      false,
      ethers.utils.parseEther("1"),
      [rscWaterfallSecond.address, alice.address],
      [ethers.utils.parseEther("10"), ethers.utils.parseEther("50")],
      [BigInt(20), BigInt(10)],
      [baseToken.address]
    );

    await owner.sendTransaction({
      to: rscWaterfallMain.address,
      value: ethers.utils.parseEther("50"),
    });

    expect(
      await ethers.provider.getBalance(rscWaterfallMain.address)
    ).to.be.equal(ethers.utils.parseEther("50"));

    await rscWaterfallSecond.setDistributor(rscWaterfallMain.address, true);
    await rscWaterfallMain.redistributeNativeToken();

    expect(
      await ethers.provider.getBalance(rscWaterfallMain.address)
    ).to.be.equal(0);
    expect(
      await ethers.provider.getBalance(rscWaterfallSecond.address)
    ).to.be.equal(0);
  });
});
