import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  RSCWaterfallUsd,
  RSCWaterfallFactory,
  RSCWaterfallFactory__factory,
  TestToken,
  TestToken__factory,
  MockReceiver,
  MockReceiver__factory,
} from "../typechain-types";
import { snapshot } from "./utils";

describe("RSC Waterfall USD", function () {
  let rscWaterfallUsd: RSCWaterfallUsd,
    baseToken: TestToken,
    testToken: TestToken,
    owner: SignerWithAddress,
    alice: SignerWithAddress,
    bob: SignerWithAddress,
    addr3: SignerWithAddress,
    addr4: SignerWithAddress,
    addr5: SignerWithAddress,
    snapId: string;

  async function deployRSCWaterfallUsdContract(
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
    const UsdPriceFeedMock = await ethers.getContractFactory(
      "UsdPriceFeedMock"
    );
    const usdPriceFeedMock = await UsdPriceFeedMock.deploy();
    await usdPriceFeedMock.deployed();

    const RSCWaterfallFactory = await ethers.getContractFactory(
      "RSCWaterfallFactory"
    );
    const rscWaterfallFactory = await RSCWaterfallFactory.deploy();
    await rscWaterfallFactory.deployed();

    const tx = await rscWaterfallFactory.createRSCWaterfallUsd({
      controller: controller,
      distributors: distributors,
      immutableController: immutableController,
      autoNativeTokenDistribution: autoNativeTokenDistribution,
      nativeTokenUsdPriceFeed: usdPriceFeedMock.address,
      minAutoDistributeAmount: minAutoDistributeAmount,
      initialRecipients: initialRecipients,
      maxCaps: maxCaps,
      priorities: priorities,
      supportedErc20addresses: supportedErc20addresses,
      erc20PriceFeeds: [usdPriceFeedMock.address],
      creationId: ethers.constants.HashZero,
    });

    let receipt = await tx.wait();
    const rscWaterfallContractAddress = receipt.events?.[5].args?.[0];

    const RSCWaterfall = await ethers.getContractFactory("RSCWaterfallUsd");
    const rscWaterfall = await RSCWaterfall.attach(rscWaterfallContractAddress);
    return rscWaterfall;
  }

  before(async () => {
    [owner, alice, bob, addr3, addr4, addr5] = await ethers.getSigners();

    baseToken = await new TestToken__factory(owner).deploy(
      "BaseToken",
      "BTKN",
      100000000000
    );
    testToken = await new TestToken__factory(owner).deploy(
      "TestToken",
      "TTT",
      10000000000
    );

    rscWaterfallUsd = await deployRSCWaterfallUsdContract(
      owner.address,
      [owner.address],
      false,
      true,
      ethers.utils.parseEther("1"),
      [alice.address, bob.address],
      [ethers.utils.parseEther("100000"), ethers.utils.parseEther("10000")],
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
    expect(await rscWaterfallUsd.owner()).to.be.equal(owner.address);
    expect(await rscWaterfallUsd.distributors(owner.address)).to.be.true;
    expect(await rscWaterfallUsd.controller()).to.be.equal(owner.address);
    expect(await rscWaterfallUsd.numberOfRecipients()).to.be.equal(BigInt(1));
    expect(await rscWaterfallUsd.platformFee()).to.be.equal(0);

    // Recipients settings
    expect(await rscWaterfallUsd.currentRecipient()).to.be.equal(bob.address);
    expect(await rscWaterfallUsd.recipients(0)).to.be.equal(alice.address);
    expect(
      (await rscWaterfallUsd.recipientsData(alice.address)).maxCap
    ).to.be.equal(ethers.utils.parseEther("100000"));
    expect(
      (await rscWaterfallUsd.recipientsData(alice.address)).received
    ).to.be.equal(0);
    expect(
      (await rscWaterfallUsd.recipientsData(alice.address)).priority
    ).to.be.equal(10);

    expect(
      (await rscWaterfallUsd.recipientsData(bob.address)).maxCap
    ).to.be.equal(ethers.utils.parseEther("10000"));
    expect(
      (await rscWaterfallUsd.recipientsData(bob.address)).received
    ).to.be.equal(0);
    expect(
      (await rscWaterfallUsd.recipientsData(bob.address)).priority
    ).to.be.equal(20);
  });

  it("Should add recipients correctly", async () => {
    await expect(
      rscWaterfallUsd
        .connect(addr3)
        .setRecipients([addr3.address], [2000], [BigInt(10)])
    ).to.be.revertedWithCustomError(rscWaterfallUsd, "OnlyControllerError");

    await rscWaterfallUsd.setRecipients(
      [alice.address, addr3.address],
      [ethers.utils.parseEther("100"), ethers.utils.parseEther("50")],
      [BigInt(30), BigInt(20)]
    );

    expect(await rscWaterfallUsd.numberOfRecipients()).to.be.equal(2);
    expect(await rscWaterfallUsd.currentRecipient()).to.be.equal(bob.address);
    expect(await rscWaterfallUsd.recipients(0)).to.be.equal(alice.address);
    expect(
      (await rscWaterfallUsd.recipientsData(alice.address)).maxCap
    ).to.be.equal(ethers.utils.parseEther("100"));
    expect(
      (await rscWaterfallUsd.recipientsData(alice.address)).received
    ).to.be.equal(0);
    expect(
      (await rscWaterfallUsd.recipientsData(alice.address)).priority
    ).to.be.equal(30);

    expect(await rscWaterfallUsd.recipients(1)).to.be.equal(addr3.address);
    expect(
      (await rscWaterfallUsd.recipientsData(addr3.address)).maxCap
    ).to.be.equal(ethers.utils.parseEther("50"));
    expect(
      (await rscWaterfallUsd.recipientsData(addr3.address)).received
    ).to.be.equal(0);
    expect(
      (await rscWaterfallUsd.recipientsData(addr3.address)).priority
    ).to.be.equal(20);

    await expect(rscWaterfallUsd.recipients(2)).to.be.revertedWithoutReason();

    await expect(
      rscWaterfallUsd.setRecipients(
        [alice.address, alice.address],
        [ethers.utils.parseEther("100"), ethers.utils.parseEther("50")],
        [BigInt(30), BigInt(20)]
      )
    ).to.be.revertedWithCustomError(
      rscWaterfallUsd,
      "RecipientAlreadyAddedError"
    );
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
      to: rscWaterfallUsd.address,
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

    expect(await rscWaterfallUsd.currentRecipient()).to.be.equal(bob.address);

    expect(
      (await rscWaterfallUsd.recipientsData(bob.address)).received
    ).to.be.equal(ethers.utils.parseEther("5000"));

    // Second Buy
    // Send rest of max cap to bob, should switch currentRecipient to alice

    const txHashSecondBuy = await owner.sendTransaction({
      to: rscWaterfallUsd.address,
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

    expect(await rscWaterfallUsd.currentRecipient()).to.be.equal(alice.address);
    await expect(rscWaterfallUsd.recipients(0)).to.revertedWithoutReason();
    expect(
      (await rscWaterfallUsd.recipientsData(alice.address)).received
    ).to.be.equal(0);

    // "third Buy"
    // send 1/99 to alice, should stay as current recipient

    const txHashThirdBuy = await owner.sendTransaction({
      to: rscWaterfallUsd.address,
      value: ethers.utils.parseEther("1"),
    });

    const aliceBalanceAfterThirdBuy = (
      await ethers.provider.getBalance(alice.address)
    ).toBigInt();
    const bobBalanceAfterThirdBuy = (
      await ethers.provider.getBalance(bob.address)
    ).toBigInt();

    expect(await rscWaterfallUsd.currentRecipient()).to.be.equal(alice.address);
    expect(
      (await rscWaterfallUsd.recipientsData(alice.address)).received
    ).to.be.equal(ethers.utils.parseEther("1000"));

    // Fourth buy
    // send rest to alice and 1 eth on top, currentRecipient should be ZERO_ADDRESS because there are no more recipients
    // contract should have balance of 1

    const txHashFourthBuy = await owner.sendTransaction({
      to: rscWaterfallUsd.address,
      value: ethers.utils.parseEther("100"),
    });

    const aliceBalanceAfterFourthBuy = (
      await ethers.provider.getBalance(alice.address)
    ).toBigInt();
    const bobBalanceAfterFourthBuy = (
      await ethers.provider.getBalance(bob.address)
    ).toBigInt();
    const rscContractBalance = (
      await ethers.provider.getBalance(rscWaterfallUsd.address)
    ).toBigInt();

    expect(rscContractBalance).to.be.equal(ethers.utils.parseEther("1"));
    expect(await rscWaterfallUsd.currentRecipient()).to.be.equal(
      ethers.constants.AddressZero
    );
    await expect(rscWaterfallUsd.recipients(0)).to.revertedWithoutReason();

    // Fifth buy
    // Send 4 Eth to RSC, because there is no currentRecipient all eth will be send to contract

    const txHashFifthBuy = await owner.sendTransaction({
      to: rscWaterfallUsd.address,
      value: ethers.utils.parseEther("4"),
    });

    const rscContractBalanceEmptyBuy = (
      await ethers.provider.getBalance(rscWaterfallUsd.address)
    ).toBigInt();
    expect(rscContractBalanceEmptyBuy).to.be.equal(
      ethers.utils.parseEther("5")
    );

    // Sixth buy
    // Set new recipients and currentRecipient (addr3) should receive 5 eth from RSC contract
    await rscWaterfallUsd.setRecipients(
      [addr3.address],
      [ethers.utils.parseEther("10000")],
      [BigInt(10)]
    );

    const addr3BalanceBefore = (
      await ethers.provider.getBalance(addr3.address)
    ).toBigInt();

    const txHashSixthBuy = await owner.sendTransaction({
      to: rscWaterfallUsd.address,
      value: ethers.utils.parseEther("5"),
    });

    const addr3BalanceAfter = (
      await ethers.provider.getBalance(addr3.address)
    ).toBigInt();

    expect(
      await ethers.provider.getBalance(rscWaterfallUsd.address)
    ).to.be.equal(0);
    expect(
      addr3BalanceBefore + ethers.utils.parseEther("10").toBigInt()
    ).to.be.equal(addr3BalanceAfter);
    expect(await rscWaterfallUsd.currentRecipient()).to.be.equal(
      ethers.constants.AddressZero
    );

    // Seventh buy
    // Set 3 recipients and 2 of them should be fulfilled in 1 TX
    await rscWaterfallUsd.setRecipients(
      [alice.address, bob.address, addr3.address],
      [
        ethers.utils.parseEther("10000"),
        ethers.utils.parseEther("10000"),
        ethers.utils.parseEther("10000"),
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
      to: rscWaterfallUsd.address,
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

    expect(await rscWaterfallUsd.numberOfRecipients()).to.be.equal(0);
    expect(await rscWaterfallUsd.currentRecipient()).to.be.equal(addr3.address);
    expect(
      (await ethers.provider.getBalance(rscWaterfallUsd.address)).toBigInt()
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
      (await rscWaterfallUsd.recipientsData(addr3.address)).received
    ).to.be.equal(ethers.utils.parseEther("5000"));
  });

  it("Should redistribute ERC20 token", async () => {
    const UsdPriceFeedMock = await ethers.getContractFactory(
      "UsdPriceFeedMock"
    );
    const usdPriceFeedMock = await UsdPriceFeedMock.deploy();
    await usdPriceFeedMock.deployed();

    await baseToken.transfer(
      rscWaterfallUsd.address,
      ethers.utils.parseEther("10")
    );

    await rscWaterfallUsd.setTokenUsdPriceFeed(
      baseToken.address,
      usdPriceFeedMock.address
    );
    await rscWaterfallUsd.redistributeToken(baseToken.address);

    expect(await baseToken.balanceOf(rscWaterfallUsd.address)).to.be.equal(0);
    expect(await baseToken.balanceOf(alice.address)).to.be.equal(0);
    expect(await baseToken.balanceOf(bob.address)).to.be.equal(
      ethers.utils.parseEther("10")
    );
    expect(await rscWaterfallUsd.currentRecipient()).to.be.equal(alice.address);
    expect(await rscWaterfallUsd.numberOfRecipients()).to.be.equal(0);

    await baseToken.transfer(
      rscWaterfallUsd.address,
      ethers.utils.parseEther("105")
    );
    await rscWaterfallUsd.redistributeToken(baseToken.address);
    expect(await baseToken.balanceOf(rscWaterfallUsd.address)).to.be.equal(
      ethers.utils.parseEther("5")
    );
    expect(await baseToken.balanceOf(alice.address)).to.be.equal(
      ethers.utils.parseEther("100")
    );
    expect(await baseToken.balanceOf(bob.address)).to.be.equal(
      ethers.utils.parseEther("10")
    );

    await rscWaterfallUsd.setRecipients(
      [addr3.address],
      [ethers.utils.parseEther("10000")],
      [BigInt(10)]
    );
    await testToken.transfer(
      rscWaterfallUsd.address,
      ethers.utils.parseEther("100")
    );
    await expect(
      rscWaterfallUsd.redistributeToken(testToken.address)
    ).to.be.revertedWithCustomError(
      rscWaterfallUsd,
      "TokenMissingUsdPriceOracle"
    );

    await expect(
      rscWaterfallUsd.connect(alice).redistributeToken(baseToken.address)
    ).to.be.revertedWithCustomError(rscWaterfallUsd, "OnlyDistributorError");
  });

  it("Should initialize only once", async () => {
    await expect(
      rscWaterfallUsd.initialize(
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
        [BigInt(10)],
        alice.address
      )
    ).to.be.revertedWith("Initializable: contract is already initialized");
  });

  it("Should transfer ownership correctly", async () => {
    await rscWaterfallUsd.transferOwnership(alice.address);
    expect(await rscWaterfallUsd.owner()).to.be.equal(alice.address);
  });

  it("Should deploy and create immutable contract", async () => {
    const rscWaterfallImmutable = await deployRSCWaterfallUsdContract(
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
    const rscWaterfallUsdManualDistribution =
      await deployRSCWaterfallUsdContract(
        owner.address,
        [owner.address],
        false,
        false,
        ethers.utils.parseEther("1"),
        [alice.address, bob.address],
        [ethers.utils.parseEther("100000"), ethers.utils.parseEther("50000")],
        [BigInt(10), BigInt(20)],
        [baseToken.address]
      );

    const transactionHash = await owner.sendTransaction({
      to: rscWaterfallUsdManualDistribution.address,
      value: ethers.utils.parseEther("5"),
    });

    const contractBalance = (
      await ethers.provider.getBalance(
        rscWaterfallUsdManualDistribution.address
      )
    ).toBigInt();
    expect(contractBalance).to.be.equal(ethers.utils.parseEther("5"));

    await expect(
      rscWaterfallUsdManualDistribution.connect(addr3).redistributeNativeToken()
    ).to.be.revertedWithCustomError(
      rscWaterfallUsdManualDistribution,
      "OnlyDistributorError"
    );

    const priorityRecipientBeforeBalance = (
      await ethers.provider.getBalance(bob.address)
    ).toBigInt();
    await rscWaterfallUsdManualDistribution.redistributeNativeToken();

    const contractBalance2 = (
      await ethers.provider.getBalance(
        rscWaterfallUsdManualDistribution.address
      )
    ).toBigInt();
    expect(contractBalance2).to.be.equal(0);

    const priorityRecipientBalanceAfter = (
      await ethers.provider.getBalance(bob.address)
    ).toBigInt();
    expect(priorityRecipientBalanceAfter).to.be.equal(
      priorityRecipientBeforeBalance + ethers.utils.parseEther("5").toBigInt()
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

    await rscWaterfallFeeFactory.setPlatformFee(BigInt(5000000));
    await rscWaterfallFeeFactory.setPlatformWallet(addr4.address);

    const platformWallet = addr4.address;
    expect(await rscWaterfallFeeFactory.platformWallet()).to.be.equal(
      platformWallet
    );
    expect(await rscWaterfallFeeFactory.platformFee()).to.be.equal(
      BigInt(5000000)
    );

    const UsdPriceFeedMock = await ethers.getContractFactory(
      "UsdPriceFeedMock"
    );
    const usdPriceFeedMock = await UsdPriceFeedMock.deploy();
    await usdPriceFeedMock.deployed();

    const txFee = await rscWaterfallFeeFactory.createRSCWaterfallUsd({
      controller: owner.address,
      distributors: [owner.address],
      immutableController: false,
      autoNativeTokenDistribution: true,
      minAutoDistributeAmount: ethers.utils.parseEther("1"),
      nativeTokenUsdPriceFeed: usdPriceFeedMock.address,
      initialRecipients: [alice.address, bob.address],
      maxCaps: [
        ethers.utils.parseEther("50000"),
        ethers.utils.parseEther("10000"),
      ],
      priorities: [BigInt(10), BigInt(20)],
      supportedErc20addresses: [baseToken.address],
      erc20PriceFeeds: [usdPriceFeedMock.address],
      creationId: ethers.constants.HashZero,
    });

    let receipt = await txFee.wait();
    const revenueShareContractAddress = receipt.events?.[5].args?.[0];
    const RevenueShareContract = await ethers.getContractFactory(
      "RSCWaterfallUsd"
    );
    const rscFeeWaterfallUsd = await RevenueShareContract.attach(
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
      to: rscFeeWaterfallUsd.address,
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
      rscFeeWaterfallUsd.address,
      ethers.utils.parseEther("100")
    );

    await rscFeeWaterfallUsd.redistributeToken(baseToken.address);

    expect(await baseToken.balanceOf(platformWallet)).to.be.equal(
      ethers.utils.parseEther("50")
    );
    expect(await baseToken.balanceOf(rscFeeWaterfallUsd.address)).to.be.equal(
      ethers.utils.parseEther("15")
    );
    expect(await baseToken.balanceOf(alice.address)).to.be.equal(
      ethers.utils.parseEther("35")
    );
  });

  it("Should work with creation ID correctly", async () => {
    const RSCWaterfallCreationIdFactory = await ethers.getContractFactory(
      "RSCWaterfallFactory"
    );
    const rscWaterfallCreationIdFactory =
      await RSCWaterfallCreationIdFactory.deploy();
    await rscWaterfallCreationIdFactory.deployed();

    const UsdPriceFeedMock = await ethers.getContractFactory(
      "UsdPriceFeedMock"
    );
    const usdPriceFeedMock = await UsdPriceFeedMock.deploy();
    await usdPriceFeedMock.deployed();

    await rscWaterfallCreationIdFactory.createRSCWaterfallUsd({
      controller: owner.address,
      distributors: [owner.address],
      immutableController: false,
      autoNativeTokenDistribution: true,
      minAutoDistributeAmount: ethers.utils.parseEther("1"),
      nativeTokenUsdPriceFeed: usdPriceFeedMock.address,
      initialRecipients: [alice.address, bob.address],
      maxCaps: [ethers.utils.parseEther("50"), ethers.utils.parseEther("10")],
      priorities: [BigInt(10), BigInt(20)],
      supportedErc20addresses: [baseToken.address],
      erc20PriceFeeds: [usdPriceFeedMock.address],
      creationId: ethers.utils.formatBytes32String("test-creation-id-1"),
    });

    await expect(
      rscWaterfallCreationIdFactory.createRSCWaterfallUsd({
        controller: owner.address,
        distributors: [owner.address],
        immutableController: false,
        autoNativeTokenDistribution: true,
        minAutoDistributeAmount: ethers.utils.parseEther("1"),
        nativeTokenUsdPriceFeed: usdPriceFeedMock.address,
        initialRecipients: [alice.address, bob.address],
        maxCaps: [ethers.utils.parseEther("50"), ethers.utils.parseEther("10")],
        priorities: [BigInt(10), BigInt(20)],
        supportedErc20addresses: [baseToken.address],
        erc20PriceFeeds: [usdPriceFeedMock.address],
        creationId: ethers.utils.formatBytes32String("test-creation-id-1"),
      })
    ).to.be.revertedWithCustomError(
      rscWaterfallCreationIdFactory,
      "CreationIdAlreadyProcessed"
    );

    await rscWaterfallCreationIdFactory.createRSCWaterfallUsd({
      controller: owner.address,
      distributors: [owner.address],
      immutableController: false,
      autoNativeTokenDistribution: true,
      minAutoDistributeAmount: ethers.utils.parseEther("1"),
      nativeTokenUsdPriceFeed: usdPriceFeedMock.address,
      initialRecipients: [alice.address, bob.address],
      maxCaps: [ethers.utils.parseEther("50"), ethers.utils.parseEther("10")],
      priorities: [BigInt(10), BigInt(20)],
      supportedErc20addresses: [baseToken.address],
      erc20PriceFeeds: [usdPriceFeedMock.address],
      creationId: ethers.utils.formatBytes32String("test-creation-id-2"),
    });
  });

  it("Should recursively erc20 split", async () => {
    const rscWaterfallSecond = await deployRSCWaterfallUsdContract(
      owner.address,
      [owner.address],
      false,
      false,
      ethers.utils.parseEther("1"),
      [alice.address, bob.address],
      [ethers.utils.parseEther("100000"), ethers.utils.parseEther("50000")],
      [BigInt(10), BigInt(20)],
      [baseToken.address]
    );

    const rscWaterfallMain = await deployRSCWaterfallUsdContract(
      owner.address,
      [owner.address],
      false,
      false,
      ethers.utils.parseEther("1"),
      [rscWaterfallSecond.address, alice.address],
      [ethers.utils.parseEther("10000"), ethers.utils.parseEther("90000")],
      [BigInt(20), BigInt(10)],
      [baseToken.address]
    );

    await baseToken.transfer(
      rscWaterfallMain.address,
      ethers.utils.parseEther("100")
    );
    await baseToken.transfer(
      rscWaterfallSecond.address,
      ethers.utils.parseEther("90")
    );

    await rscWaterfallSecond.setDistributor(rscWaterfallMain.address, true);
    await rscWaterfallMain.redistributeToken(baseToken.address);

    expect(await baseToken.balanceOf(rscWaterfallMain.address)).to.be.equal(0);
    expect(await baseToken.balanceOf(rscWaterfallSecond.address)).to.be.equal(
      0
    );
  });

  it("Should recursively split ETH", async () => {
    const rscWaterfallSecond = await deployRSCWaterfallUsdContract(
      owner.address,
      [owner.address],
      false,
      false,
      ethers.utils.parseEther("1"),
      [alice.address, bob.address],
      [
        ethers.utils.parseEther("100000000"),
        ethers.utils.parseEther("50000000"),
      ],
      [BigInt(10), BigInt(20)],
      [baseToken.address]
    );

    const rscWaterfallMain = await deployRSCWaterfallUsdContract(
      owner.address,
      [owner.address],
      false,
      false,
      ethers.utils.parseEther("1"),
      [rscWaterfallSecond.address, alice.address],
      [ethers.utils.parseEther("10000"), ethers.utils.parseEther("50000")],
      [BigInt(20), BigInt(10)],
      [baseToken.address]
    );

    await owner.sendTransaction({
      to: rscWaterfallMain.address,
      value: ethers.utils.parseEther("60"),
    });
    await owner.sendTransaction({
      to: rscWaterfallSecond.address,
      value: ethers.utils.parseEther("50"),
    });

    expect(
      await ethers.provider.getBalance(rscWaterfallMain.address)
    ).to.be.equal(ethers.utils.parseEther("60"));

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
